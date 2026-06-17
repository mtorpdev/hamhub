using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Api.Services;

public record QsoAwardBackfillResult(int Scanned, int Updated);

public class QsoAwardEnrichmentService
{
    private readonly ApplicationDbContext _context;
    private readonly DxccLookupService _dxccLookup;

    public QsoAwardEnrichmentService(ApplicationDbContext context, DxccLookupService dxccLookup)
    {
        _context = context;
        _dxccLookup = dxccLookup;
    }

    public bool Enrich(QsoEntry qso)
    {
        var lookup = _dxccLookup.Lookup(qso.WorkedCallsign);
        if (lookup is null) return false;

        var changed = false;
        changed |= FillIfMissing(() => qso.Country, value => qso.Country = value, lookup.Country);
        changed |= FillIfMissing(() => qso.Dxcc, value => qso.Dxcc = value, lookup.Dxcc);
        changed |= FillIfMissing(() => qso.Continent, value => qso.Continent = value, lookup.Continent);
        changed |= FillIfMissing(() => qso.CqZone, value => qso.CqZone = value, lookup.CqZone > 0 ? lookup.CqZone : null);
        changed |= FillIfMissing(() => qso.ItuZone, value => qso.ItuZone = value, lookup.ItuZone > 0 ? lookup.ItuZone : null);
        return changed;
    }

    public async Task<QsoAwardBackfillResult> BackfillMissingAsync(CancellationToken ct = default)
    {
        var qsos = await _context.QsoEntries
            .Where(qso => qso.Country == null ||
                          qso.Dxcc == null ||
                          qso.Continent == null ||
                          qso.CqZone == null ||
                          qso.ItuZone == null)
            .ToListAsync(ct);

        var updated = 0;
        foreach (var qso in qsos)
        {
            if (!Enrich(qso)) continue;
            qso.UpdatedAt = DateTime.UtcNow;
            updated++;
        }

        if (updated > 0)
            await _context.SaveChangesAsync(ct);

        return new QsoAwardBackfillResult(qsos.Count, updated);
    }

    private static bool FillIfMissing<T>(Func<T?> current, Action<T> set, T? candidate)
    {
        if (current() is not null || candidate is null) return false;
        set(candidate);
        return true;
    }
}
