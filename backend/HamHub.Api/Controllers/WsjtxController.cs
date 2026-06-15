using System.Text.Json;
using AutoMapper;
using HamHub.Api.Services;
using HamHub.Application.Wsjtx.DTOs;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using WsjtxAgentCommand = HamHub.WsjtxCore.Models.WsjtxAgentCommand;
using WsjtxCommandType = HamHub.WsjtxCore.Models.WsjtxCommandType;
using WsjtxReplyCommand = HamHub.WsjtxCore.Models.WsjtxReplyCommand;
using WsjtxStatusDto = HamHub.WsjtxCore.Models.WsjtxStatusDto;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
    private readonly IMapper _mapper;
    private readonly WsjtxBroadcaster _broadcaster;
    private readonly WsjtxCommandQueue _commands;
    private readonly WsjtxStatusCache _statusCache;

    public WsjtxController(
        ApplicationDbContext db,
        IMapper mapper,
        WsjtxBroadcaster broadcaster,
        WsjtxCommandQueue commands,
        WsjtxStatusCache statusCache)
    {
        _db = db;
        _mapper = mapper;
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

        var decodes = await _db.WsjtxDecodes
            .Where(d => d.UserId == userId)
            .OrderByDescending(d => d.DecodedAt)
            .Take(limit)
            .Select(d => new WsjtxDecodeDto(
                d.Id,
                d.WsjtxId,
                d.WsjtxTimeMs,
                d.SpotterCallsign,
                d.SpotterGrid,
                d.Message,
                d.DxCallsign,
                d.DxGrid,
                d.Snr,
                d.DeltaTime,
                d.DeltaFreqHz,
                d.FrequencyMhz,
                d.Mode,
                d.LowConfidence,
                IsCallableMessage(d.Message),
                d.DecodedAt))
            .ToListAsync();

        return Ok(decodes);
    }

    // POST /api/wsjtx/decodes  [Authorize]
    [HttpPost("decodes")]
    [Authorize]
    public async Task<IActionResult> PostDecodes([FromBody] PostDecodeDto[] dtos)
    {
        if (dtos is null or { Length: 0 }) return BadRequest("Batch must not be empty.");

        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? string.Empty;

        var entities = dtos.Select(dto =>
        {
            var e = _mapper.Map<WsjtxDecode>(dto);
            e.UserId = userId;
            e.WsjtxId = string.IsNullOrWhiteSpace(dto.WsjtxId) ? "WSJT-X" : dto.WsjtxId;
            return e;
        }).ToList();

        _db.WsjtxDecodes.AddRange(entities);
        await _db.SaveChangesAsync();

        var outDtos = entities.Zip(dtos, (entity, dto) => new WsjtxDecodeDto(
            entity.Id,
            entity.WsjtxId,
            entity.WsjtxTimeMs,
            entity.SpotterCallsign,
            entity.SpotterGrid,
            entity.Message,
            entity.DxCallsign,
            entity.DxGrid,
            entity.Snr,
            entity.DeltaTime,
            entity.DeltaFreqHz,
            entity.FrequencyMhz,
            entity.Mode,
            entity.LowConfidence,
            IsCallableMessage(entity.Message),
            entity.DecodedAt)).ToList();
        _broadcaster.Broadcast(outDtos);

        return NoContent();
    }

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
    [HttpPost("commands/cq")]
    public IActionResult QueueStartCq()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
        var callsign = User.FindFirst("callsign")?.Value;
        if (string.IsNullOrWhiteSpace(callsign))
            callsign = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
        if (string.IsNullOrWhiteSpace(callsign))
            return BadRequest("Brugeren har ikke et kaldesignal.");

        var queued = _commands.EnqueueStartCq(userId, callsign);
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
