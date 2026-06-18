namespace HamHub.Domain.Entities;

public enum CommunityGroupVisibility
{
    Public = 1,
    RequestToJoin = 2,
    InviteOnly = 3
}

public enum CommunityGroupRole
{
    Owner = 1,
    Admin = 2,
    Member = 3
}

public enum CommunityGroupRequestStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
    Cancelled = 4
}

public enum CommunityGroupMembershipStatus
{
    None = 0,
    Owner = 1,
    Admin = 2,
    Member = 3,
    Pending = 4
}
