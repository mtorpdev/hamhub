using AutoMapper;
using HamHub.Application.Articles.DTOs;
using HamHub.Application.DxSpots.DTOs;
using HamHub.Application.QsoEntries.DTOs;
using HamHub.Application.Stations.DTOs;
using HamHub.Application.Users.DTOs;
using HamHub.Application.Wsjtx.DTOs;
using HamHub.Domain.Entities;

namespace HamHub.Application.Common.Mappings;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<ApplicationUser, UserDto>();

        CreateMap<StationProfile, StationDto>();
        CreateMap<CreateStationDto, StationProfile>()
            .ForMember(d => d.SupportedModes, o => o.MapFrom(s => s.SupportedModes ?? new()))
            .ForMember(d => d.SupportedBands, o => o.MapFrom(s => s.SupportedBands ?? new()));

        CreateMap<QsoEntry, QsoDto>();
        CreateMap<CreateQsoDto, QsoEntry>();

        CreateMap<DxSpot, DxSpotDto>()
            .ForMember(d => d.SpotterCallsign, o => o.MapFrom(s => s.User != null ? s.User.Callsign : string.Empty));
        CreateMap<CreateDxSpotDto, DxSpot>();

        CreateMap<Article, ArticleDto>()
            .ForMember(d => d.CategoryName, o => o.MapFrom(s => s.Category.Name))
            .ForMember(d => d.AuthorCallsign, o => o.MapFrom(s => s.Author != null ? s.Author.Callsign : null));
        CreateMap<CreateArticleDto, Article>();

        CreateMap<WsjtxDecode, WsjtxDecodeDto>();
        CreateMap<PostDecodeDto, WsjtxDecode>();
    }
}
