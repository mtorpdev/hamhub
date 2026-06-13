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
        if (dtos.Length == 0) return NoContent();

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
    [HttpGet("stream")]
    public async Task StreamDecodes(CancellationToken ct)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        using var pingTimer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        var pingTask = Task.Run(async () =>
        {
            while (await pingTimer.WaitForNextTickAsync(ct))
            {
                await Response.WriteAsync(": ping\n\n", ct);
                await Response.Body.FlushAsync(ct);
            }
        }, ct);

        await foreach (var decode in _broadcaster.Subscribe(ct))
        {
            var json = JsonSerializer.Serialize(decode, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            await Response.WriteAsync($"data: {json}\n\n", ct);
            await Response.Body.FlushAsync(ct);
        }
    }
}
