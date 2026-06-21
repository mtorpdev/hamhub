using HamHub.Domain.Enums;

namespace HamHub.Domain.Entities;

public class QsoEntry
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTime DateUtc { get; set; }
    public string OwnCallsign { get; set; } = string.Empty;
    public string WorkedCallsign { get; set; } = string.Empty;
    public Band Band { get; set; }
    public double? Frequency { get; set; }
    public Mode Mode { get; set; }
    public string? RstSent { get; set; }
    public string? RstReceived { get; set; }
    public string? Submode { get; set; }       // SUBMODE (e.g. USB, LSB)
    public string? Locator { get; set; }       // GRIDSQUARE (worked station)
    public string? MyGridsquare { get; set; }  // MY_GRIDSQUARE (own station)
    public string? Country { get; set; }
    public int? Dxcc { get; set; }             // DXCC entity number
    public string? Continent { get; set; }     // CONT
    public string? State { get; set; }         // STATE
    public int? CqZone { get; set; }           // CQZ
    public int? ItuZone { get; set; }          // ITUZ
    public string? County { get; set; }        // CNTY
    public string? MyState { get; set; }       // MY_STATE
    public string? MyCounty { get; set; }      // MY_CNTY
    public string? Iota { get; set; }          // IOTA island reference
    public string? PotaRefs { get; set; }      // comma-separated POTA refs
    public string? SotaRefs { get; set; }      // comma-separated SOTA refs
    public string? AwardRefs { get; set; }     // generic award refs from ADIF or manual entry
    public string? Name { get; set; }          // NAME (operator name)
    public string? Qth { get; set; }           // QTH (city)
    public double? TxPower { get; set; }       // TX_PWR in watts
    public string? Comment { get; set; }       // COMMENT
    public string? QrzId { get; set; }         // QRZ internal log record ID; null = not yet synced
    public string? QrzConfirmationStatus { get; set; }
    public DateTime? QrzConfirmedAt { get; set; }
    public DateTime? QrzQslDate { get; set; }
    public DateTime? EqslSentAt { get; set; }
    public DateTime? EqslConfirmedAt { get; set; }
    public string? EqslLastResult { get; set; }
    public DateTime? LotwConfirmedAt { get; set; }
    public DateTime? LotwQslDate { get; set; }
    public string? LotwLastResult { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = null!;
    public QsoAnalysis? Analysis { get; set; }
}
