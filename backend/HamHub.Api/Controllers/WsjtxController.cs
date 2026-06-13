using System.Text.Json;
using AutoMapper;
using HamHub.Api.Services;
using HamHub.Application.Wsjtx.DTOs;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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

    public WsjtxController(ApplicationDbContext db, IMapper mapper, WsjtxBroadcaster broadcaster)
    {
        _db = db;
        _mapper = mapper;
        _broadcaster = broadcaster;
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
            return e;
        }).ToList();

        _db.WsjtxDecodes.AddRange(entities);
        await _db.SaveChangesAsync();

        var outDtos = _mapper.Map<List<WsjtxDecodeDto>>(entities);
        _broadcaster.Broadcast(outDtos);

        return NoContent();
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
}
