using System.Text.Json;
using HamHub.Api.Services;
using HamHub.Application.Wsjtx.DTOs;
using HamHub.Infrastructure.Persistence;
using WsjtxAgentCommand = HamHub.WsjtxCore.Models.WsjtxAgentCommand;
using WsjtxCommandType = HamHub.WsjtxCore.Models.WsjtxCommandType;
using WsjtxReplyCommand = HamHub.WsjtxCore.Models.WsjtxReplyCommand;
using WsjtxStatusDto = HamHub.WsjtxCore.Models.WsjtxStatusDto;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/wsjtx")]
public class WsjtxController : ControllerBase
{
    private static readonly JsonSerializerOptions _sseJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly ApplicationDbContext _db;
    private readonly WsjtxBroadcaster _broadcaster;
    private readonly WsjtxCommandQueue _commands;
    private readonly WsjtxStatusCache _statusCache;

    public WsjtxController(
        ApplicationDbContext db,
        WsjtxBroadcaster broadcaster,
        WsjtxCommandQueue commands,
        WsjtxStatusCache statusCache)
    {
        _db = db;
        _broadcaster = broadcaster;
        _commands = commands;
        _statusCache = statusCache;
    }

    [Authorize]
    [HttpGet("decodes")]
    public async Task<IActionResult> GetRecentDecodes([FromQuery] int limit = 200)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
        limit = Math.Clamp(limit, 1, 500);

        var columns = await GetWsjtxDecodeColumnsAsync();
        var decodes = await GetRecentDecodesCompatAsync(userId, limit, columns);

        return Ok(decodes);
    }

    // POST /api/wsjtx/decodes  [Authorize]
    [HttpPost("decodes")]
    [Authorize]
    public async Task<IActionResult> PostDecodes([FromBody] PostDecodeDto[] dtos)
    {
        if (dtos is null or { Length: 0 }) return BadRequest("Batch must not be empty.");

        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? string.Empty;

        var columns = await GetWsjtxDecodeColumnsAsync();
        var outDtos = new List<WsjtxDecodeDto>(dtos.Length);
        foreach (var dto in dtos)
        {
            var id = await InsertDecodeCompatAsync(userId, dto, columns);
            outDtos.Add(new WsjtxDecodeDto(
                id,
                string.IsNullOrWhiteSpace(dto.WsjtxId) ? "WSJT-X" : dto.WsjtxId,
                dto.WsjtxTimeMs,
                dto.SpotterCallsign,
                dto.SpotterGrid,
                dto.Message,
                dto.DxCallsign,
                dto.DxGrid,
                dto.Snr,
                dto.DeltaTime,
                dto.DeltaFreqHz,
                dto.FrequencyMhz,
                dto.Mode,
                dto.LowConfidence,
                IsCallableMessage(dto.Message),
                dto.DecodedAt));
        }
        _broadcaster.Broadcast(outDtos);

        return NoContent();
    }

    private async Task<HashSet<string>> GetWsjtxDecodeColumnsAsync()
    {
        var columns = new HashSet<string>(StringComparer.Ordinal);
        var connection = (NpgsqlConnection)_db.Database.GetDbConnection();
        var closeAfter = connection.State != System.Data.ConnectionState.Open;
        if (closeAfter) await connection.OpenAsync();
        try
        {
            await using var command = new NpgsqlCommand("""
                select column_name
                from information_schema.columns
                where table_schema = 'public' and table_name = 'WsjtxDecodes';
                """, connection);
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                columns.Add(reader.GetString(0));
        }
        finally
        {
            if (closeAfter) await connection.CloseAsync();
        }

        return columns;
    }

    private async Task<List<WsjtxDecodeDto>> GetRecentDecodesCompatAsync(
        string userId,
        int limit,
        HashSet<string> columns)
    {
        var connection = (NpgsqlConnection)_db.Database.GetDbConnection();
        var closeAfter = connection.State != System.Data.ConnectionState.Open;
        if (closeAfter) await connection.OpenAsync();
        try
        {
            var sql = $"""
                select
                    "Id",
                    {ColumnOrDefault(columns, "WsjtxId", "'WSJT-X'")} as "WsjtxId",
                    {ColumnOrDefault(columns, "WsjtxTimeMs", "0::bigint")} as "WsjtxTimeMs",
                    "SpotterCallsign",
                    {ColumnOrDefault(columns, "SpotterGrid", "null::character varying")} as "SpotterGrid",
                    "Message",
                    "DxCallsign",
                    "DxGrid",
                    "Snr",
                    "DeltaTime",
                    "DeltaFreqHz",
                    "FrequencyMhz",
                    "Mode",
                    {ColumnOrDefault(columns, "LowConfidence", "false")} as "LowConfidence",
                    "DecodedAt"
                from "WsjtxDecodes"
                where "UserId" = @userId
                order by "DecodedAt" desc
                limit @limit;
                """;

            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("userId", userId);
            command.Parameters.AddWithValue("limit", limit);
            await using var reader = await command.ExecuteReaderAsync();
            var result = new List<WsjtxDecodeDto>();
            while (await reader.ReadAsync())
            {
                var message = reader.GetString(5);
                result.Add(new WsjtxDecodeDto(
                    reader.GetInt32(0),
                    reader.GetString(1),
                    Convert.ToUInt32(reader.GetInt64(2)),
                    reader.GetString(3),
                    reader.IsDBNull(4) ? null : reader.GetString(4),
                    message,
                    reader.IsDBNull(6) ? null : reader.GetString(6),
                    reader.IsDBNull(7) ? null : reader.GetString(7),
                    reader.GetInt32(8),
                    reader.GetDouble(9),
                    reader.GetInt32(10),
                    reader.GetDouble(11),
                    reader.GetString(12),
                    reader.GetBoolean(13),
                    IsCallableMessage(message),
                    reader.GetDateTime(14)));
            }

            return result;
        }
        finally
        {
            if (closeAfter) await connection.CloseAsync();
        }
    }

    private async Task<int> InsertDecodeCompatAsync(string userId, PostDecodeDto dto, HashSet<string> columns)
    {
        var insertColumns = new List<string>
        {
            "UserId",
            "SpotterCallsign",
            "Message",
            "DxCallsign",
            "DxGrid",
            "Snr",
            "DeltaTime",
            "DeltaFreqHz",
            "FrequencyMhz",
            "Mode",
            "DecodedAt",
        };
        var values = new List<string>
        {
            "@userId",
            "@spotterCallsign",
            "@message",
            "@dxCallsign",
            "@dxGrid",
            "@snr",
            "@deltaTime",
            "@deltaFreqHz",
            "@frequencyMhz",
            "@mode",
            "@decodedAt",
        };

        if (columns.Contains("WsjtxId")) AddColumn("WsjtxId", "@wsjtxId");
        if (columns.Contains("WsjtxTimeMs")) AddColumn("WsjtxTimeMs", "@wsjtxTimeMs");
        if (columns.Contains("SpotterGrid")) AddColumn("SpotterGrid", "@spotterGrid");
        if (columns.Contains("LowConfidence")) AddColumn("LowConfidence", "@lowConfidence");

        var sql = $"""
            insert into "WsjtxDecodes" ({string.Join(", ", insertColumns.Select(c => $@"""{c}"""))})
            values ({string.Join(", ", values)})
            returning "Id";
            """;

        var connection = (NpgsqlConnection)_db.Database.GetDbConnection();
        var closeAfter = connection.State != System.Data.ConnectionState.Open;
        if (closeAfter) await connection.OpenAsync();
        try
        {
            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("userId", userId);
            command.Parameters.AddWithValue("spotterCallsign", TrimRequired(dto.SpotterCallsign, 20, "WSJT-X"));
            command.Parameters.AddWithValue("message", TrimRequired(dto.Message, 40));
            command.Parameters.AddWithValue("dxCallsign", (object?)TrimMax(dto.DxCallsign, 20) ?? DBNull.Value);
            command.Parameters.AddWithValue("dxGrid", (object?)TrimMax(dto.DxGrid, 10) ?? DBNull.Value);
            command.Parameters.AddWithValue("snr", dto.Snr);
            command.Parameters.AddWithValue("deltaTime", dto.DeltaTime);
            command.Parameters.AddWithValue("deltaFreqHz", dto.DeltaFreqHz);
            command.Parameters.AddWithValue("frequencyMhz", dto.FrequencyMhz);
            command.Parameters.AddWithValue("mode", TrimRequired(dto.Mode, 10, "FT8"));
            command.Parameters.AddWithValue("decodedAt", dto.DecodedAt);
            command.Parameters.AddWithValue("wsjtxId", TrimRequired(dto.WsjtxId, 80, "WSJT-X"));
            command.Parameters.AddWithValue("wsjtxTimeMs", (long)dto.WsjtxTimeMs);
            command.Parameters.AddWithValue("spotterGrid", (object?)TrimMax(dto.SpotterGrid, 10) ?? DBNull.Value);
            command.Parameters.AddWithValue("lowConfidence", dto.LowConfidence);

            return (int)(await command.ExecuteScalarAsync() ?? 0);
        }
        finally
        {
            if (closeAfter) await connection.CloseAsync();
        }

        void AddColumn(string column, string value)
        {
            insertColumns.Add(column);
            values.Add(value);
        }
    }

    private static string ColumnOrDefault(HashSet<string> columns, string column, string fallback) =>
        columns.Contains(column) ? $@"""{column}""" : fallback;

    private static string? TrimMax(string? value, int maxLength) =>
        string.IsNullOrEmpty(value) || value.Length <= maxLength ? value : value[..maxLength];

    private static string TrimRequired(string? value, int maxLength, string fallback = "") =>
        TrimMax(string.IsNullOrWhiteSpace(value) ? fallback : value, maxLength) ?? fallback;

    [Authorize]
    [HttpPost("commands/reply")]
    public IActionResult QueueReply([FromBody] WsjtxReplyCommand command)
    {
        if (!IsCallableMessage(command.Message))
            return BadRequest("Kun CQ/QRZ decodes kan kaldes via WSJT-X Reply.");

        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
        var queued = _commands.EnqueueReply(userId, command);
        return Accepted(new { queued.Id, queued.Type });
    }

    [Authorize]
    [HttpPost("commands/stop")]
    public IActionResult QueueStopTx()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
        var queued = _commands.EnqueueStopTx(userId);
        return Accepted(new { queued.Id, queued.Type });
    }

    [Authorize]
    [HttpGet("commands/next")]
    public IActionResult GetNextCommand()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
        return _commands.TryDequeue(userId, out var command) ? Ok(command) : NoContent();
    }

    [Authorize]
    [HttpPost("commands/{id:guid}/result")]
    public IActionResult CompleteCommand(Guid id, [FromBody] CompleteWsjtxCommandRequest request)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
        _commands.Complete(userId, id, request.Type, request.Success, request.Message);
        return NoContent();
    }

    [Authorize]
    [HttpGet("commands/results")]
    public IActionResult GetCommandResults()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
        return Ok(_commands.GetRecentResults(userId));
    }

    [Authorize]
    [HttpPost("status")]
    public IActionResult PostStatus([FromBody] WsjtxStatusDto status)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
        _statusCache.Update(userId, status);
        return NoContent();
    }

    [Authorize]
    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
        var status = _statusCache.GetLatest(userId);
        return status is null ? NoContent() : Ok(status);
    }

    // GET /api/wsjtx/stream  — intentionally public (community feed)
    [AllowAnonymous]
    [HttpGet("stream")]
    public async Task StreamDecodes(CancellationToken ct)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        // Disable Kestrel response buffering for immediate event delivery
        var bufferingFeature = HttpContext.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpResponseBodyFeature>();
        bufferingFeature?.DisableBuffering();

        // Merge pings (null) and decode JSON strings into a single channel
        // so there is only ONE writer to Response.Body
        var merged = System.Threading.Channels.Channel.CreateUnbounded<string?>(
            new System.Threading.Channels.UnboundedChannelOptions { SingleReader = true });

        // Ping producer — writes null to merged channel every 30s
        using var pingTimer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        _ = Task.Run(async () =>
        {
            try
            {
                while (await pingTimer.WaitForNextTickAsync(ct))
                    await merged.Writer.WriteAsync(null, ct);
            }
            catch (OperationCanceledException) { }
            finally { merged.Writer.TryComplete(); }
        }, ct);

        // Decode producer — writes serialised JSON strings to merged channel
        _ = Task.Run(async () =>
        {
            try
            {
                await foreach (var decode in _broadcaster.Subscribe(ct))
                    await merged.Writer.WriteAsync(
                        JsonSerializer.Serialize(decode, _sseJsonOptions), ct);
            }
            catch (OperationCanceledException) { }
            finally { merged.Writer.TryComplete(); }
        }, ct);

        // Single consumer — only this code writes to Response.Body
        await foreach (var item in merged.Reader.ReadAllAsync(ct))
        {
            var line = item is null ? ": ping\n\n" : $"data: {item}\n\n";
            await Response.WriteAsync(line, ct);
            await Response.Body.FlushAsync(ct);
        }
    }

    private static bool IsCallableMessage(string message)
    {
        var trimmed = message.TrimStart();
        return trimmed.StartsWith("CQ ", StringComparison.OrdinalIgnoreCase)
            || trimmed.StartsWith("QRZ ", StringComparison.OrdinalIgnoreCase);
    }
}

public record CompleteWsjtxCommandRequest(WsjtxCommandType Type, bool Success, string Message);
