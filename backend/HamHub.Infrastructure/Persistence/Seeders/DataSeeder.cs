using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Infrastructure.Persistence.Seeders;

public static class DataSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context, UserManager<ApplicationUser> userManager, RoleManager<IdentityRole> roleManager)
    {
        await SeedRolesAsync(roleManager);
        var admin = await SeedAdminAsync(userManager);
        var users = await SeedUsersAsync(userManager);
        await SeedCategoriesAsync(context);
        await context.SaveChangesAsync();
        await SeedArticlesAsync(context, admin.Id);
        await SeedStationsAsync(context, users);
        await SeedQsosAsync(context, users);
        await SeedSpotsAsync(context, users);
    }

    private static async Task SeedRolesAsync(RoleManager<IdentityRole> roleManager)
    {
        foreach (var role in new[] { "Admin", "User" })
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
        }
    }

    private static async Task<ApplicationUser> SeedAdminAsync(UserManager<ApplicationUser> userManager)
    {
        const string adminEmail = "admin@hamhub.local";
        var existing = await userManager.FindByEmailAsync(adminEmail);
        if (existing != null) return existing;

        var admin = new ApplicationUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            EmailConfirmed = true,
            Callsign = "OZ1ADM",
            FirstName = "Admin",
            LastName = "HamHub",
            Country = "Denmark",
            GridLocator = "JO55WM",
            LicenseClass = LicenseClass.Full
        };
        await userManager.CreateAsync(admin, "Admin123!");
        await userManager.AddToRoleAsync(admin, "Admin");
        await userManager.AddToRoleAsync(admin, "User");
        return admin;
    }

    private static async Task<List<ApplicationUser>> SeedUsersAsync(UserManager<ApplicationUser> userManager)
    {
        var usersData = new[]
        {
            ("oz5abc@hamhub.local", "OZ5ABC", "Anders", "Christensen", "JO55WM"),
            ("oz6def@hamhub.local", "OZ6DEF", "Bente", "Davidsen", "JO46OX"),
            ("oz7ghi@hamhub.local", "OZ7GHI", "Carl", "Eriksen", "JO65FX"),
            ("oz8jkl@hamhub.local", "OZ8JKL", "Dorte", "Frederiksen", "JO44XW"),
            ("oz9mno@hamhub.local", "OZ9MNO", "Erik", "Gregersen", "JO57DI")
        };

        var users = new List<ApplicationUser>();
        foreach (var (email, call, first, last, grid) in usersData)
        {
            var existing = await userManager.FindByEmailAsync(email);
            if (existing != null) { users.Add(existing); continue; }

            var user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                Callsign = call,
                FirstName = first,
                LastName = last,
                Country = "Denmark",
                GridLocator = grid,
                LicenseClass = LicenseClass.Full
            };
            await userManager.CreateAsync(user, "User123!");
            await userManager.AddToRoleAsync(user, "User");
            users.Add(user);
        }
        return users;
    }

    private static async Task SeedCategoriesAsync(ApplicationDbContext context)
    {
        if (await context.ArticleCategories.AnyAsync()) return;

        var categories = new[]
        {
            new ArticleCategory { Name = "Kom godt i gang", Slug = "kom-godt-i-gang" },
            new ArticleCategory { Name = "HF", Slug = "hf" },
            new ArticleCategory { Name = "VHF/UHF", Slug = "vhf-uhf" },
            new ArticleCategory { Name = "FT8", Slug = "ft8" },
            new ArticleCategory { Name = "SDR", Slug = "sdr" },
            new ArticleCategory { Name = "Antenner", Slug = "antenner" },
            new ArticleCategory { Name = "Licens", Slug = "licens" },
            new ArticleCategory { Name = "Danske regler", Slug = "danske-regler" }
        };
        context.ArticleCategories.AddRange(categories);
    }

    private static async Task SeedArticlesAsync(ApplicationDbContext context, string adminId)
    {
        if (await context.Articles.AnyAsync()) return;

        var category = await context.ArticleCategories.FirstAsync();
        var articles = new[]
        {
            new Article { Title = "Velkommen til HamHub", Slug = "velkommen-til-hamhub", Summary = "Din nye platform for amatørradio i Danmark.", Content = "HamHub er bygget for radiomænd og -kvinder der vil have et moderne sted at logge QSOer, spotte DX og dele viden med hinanden.", CategoryId = category.Id, AuthorId = adminId, IsPublished = true, PublishDate = DateTime.UtcNow.AddDays(-10) },
            new Article { Title = "Kom i gang med FT8", Slug = "kom-i-gang-med-ft8", Summary = "En introduktion til den populære digitale mode.", Content = "FT8 er en digital sendemåde udviklet af Joe Taylor K1JT. Du skal bruge WSJT-X software, et lydkort og en transceiver med CAT-kontrol.", CategoryId = category.Id, AuthorId = adminId, IsPublished = true, PublishDate = DateTime.UtcNow.AddDays(-7) },
            new Article { Title = "Din første HF-antenne", Slug = "din-foerste-hf-antenne", Summary = "Sådan bygger du en simpel dipol.", Content = "En halv-bølge dipol er den enkleste og mest effektive antenne for begyndere. Du skal bruge koaksialkabel, lidt wire og et par isolatorer.", CategoryId = category.Id, AuthorId = adminId, IsPublished = true, PublishDate = DateTime.UtcNow.AddDays(-5) },
            new Article { Title = "Forstå SDR", Slug = "forstaa-sdr", Summary = "Software Defined Radio for begyndere.", Content = "Med en RTL-SDR dongle til under 100 kr kan du modtage signaler fra 500 kHz til 1,7 GHz. Installer SDR# og start udforskningen.", CategoryId = category.Id, AuthorId = adminId, IsPublished = true, PublishDate = DateTime.UtcNow.AddDays(-3) },
            new Article { Title = "Dansk amatørradiolovgivning", Slug = "dansk-amatørradiolovgivning", Summary = "Hvad du må og ikke må som OZ.", Content = "I Danmark er amatørradio reguleret af Erhvervsstyrelsen. Som dansk amatørradiooperatør skal du have en licens og overholde IARU-regionens bandplan.", CategoryId = category.Id, AuthorId = adminId, IsPublished = true, PublishDate = DateTime.UtcNow.AddDays(-1) }
        };
        context.Articles.AddRange(articles);
        await context.SaveChangesAsync();
    }

    private static async Task SeedStationsAsync(ApplicationDbContext context, List<ApplicationUser> users)
    {
        if (await context.StationProfiles.AnyAsync()) return;

        var stations = users.Select((u, i) => new StationProfile
        {
            UserId = u.Id,
            Name = $"{u.Callsign} Hovedstation",
            Callsign = u.Callsign,
            RadioEquipment = new[] { "Icom IC-7300", "Yaesu FT-991A", "Kenwood TS-590SG", "Elecraft K3", "Icom IC-705" }[i],
            AntennaDescription = new[] { "Endfed 40m", "Dipol 20m", "Vertikal GP", "Hexbeam 6-20m", "Magnetisk loop" }[i],
            PowerOutput = new[] { 100, 100, 50, 100, 10 }[i],
            Location = "Danmark",
            GridLocator = u.GridLocator,
            SupportedModes = new List<Mode> { Mode.SSB, Mode.CW, Mode.FT8 },
            SupportedBands = new List<Band> { Band.M40, Band.M20, Band.M15, Band.M10 }
        }).ToList();

        context.StationProfiles.AddRange(stations);
        await context.SaveChangesAsync();
    }

    private static async Task SeedQsosAsync(ApplicationDbContext context, List<ApplicationUser> users)
    {
        if (await context.QsoEntries.AnyAsync()) return;

        var rand = new Random(42);
        var callsigns = new[] { "DL1ABC", "G3XYZ", "SP5DEF", "PA3GHI", "SM6JKL", "OH2MNO", "LA4PQR", "EA5STU", "F5VWX", "I2YZA" };
        var bands = Enum.GetValues<Band>();
        var modes = new[] { Mode.SSB, Mode.CW, Mode.FT8 };
        var qsos = new List<QsoEntry>();

        for (int i = 0; i < 20; i++)
        {
            var user = users[i % users.Count];
            qsos.Add(new QsoEntry
            {
                UserId = user.Id,
                DateUtc = DateTime.UtcNow.AddDays(-rand.Next(1, 90)).AddHours(-rand.Next(0, 24)),
                OwnCallsign = user.Callsign!,
                WorkedCallsign = callsigns[rand.Next(callsigns.Length)],
                Band = bands[rand.Next(bands.Length)],
                Frequency = 14.074 + rand.NextDouble() * 0.1,
                Mode = modes[rand.Next(modes.Length)],
                RstSent = "599",
                RstReceived = "599",
                Country = new[] { "Germany", "England", "Poland", "Netherlands", "Sweden", "Finland", "Norway", "Spain", "France", "Italy" }[i % 10]
            });
        }

        context.QsoEntries.AddRange(qsos);
        await context.SaveChangesAsync();
    }

    private static async Task SeedSpotsAsync(ApplicationDbContext context, List<ApplicationUser> users)
    {
        if (await context.DxSpots.AnyAsync()) return;

        var rand = new Random(42);
        var dxCallsigns = new[] { "VP9/G3XYZ", "VK2ABC", "JA1DEF", "W1GHI", "ZL2JKL", "VE3MNO", "PY2PQR", "UA9STU", "ZS6VWX", "4X4YZA" };
        var spots = new List<DxSpot>();

        for (int i = 0; i < 10; i++)
        {
            var user = users[i % users.Count];
            spots.Add(new DxSpot
            {
                UserId = user.Id,
                Callsign = dxCallsigns[i],
                Frequency = new[] { 14.074, 21.074, 28.074, 7.074, 18.100, 14.225, 21.300, 28.500, 7.060, 3.573 }[i],
                Band = new[] { Band.M20, Band.M15, Band.M10, Band.M40, Band.M17, Band.M20, Band.M15, Band.M10, Band.M40, Band.M80 }[i],
                Mode = i % 3 == 0 ? Mode.SSB : Mode.FT8,
                Comment = new[] { "Stærkt signal 59+", "FT8 aktivt", "Sjælden DX", "God udbredelse", "Contest station", "DX-pedition", "Heard in EU", "599 her", "Rare entity", "Arbejder alle" }[i],
                SpottedAt = DateTime.UtcNow.AddMinutes(-rand.Next(1, 120))
            });
        }

        context.DxSpots.AddRange(spots);
        await context.SaveChangesAsync();
    }
}
