-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('admin', 'official', 'viewer');

-- Create team type enum
CREATE TYPE public.team_type AS ENUM ('5-a-side', '7-a-side', '9-a-side', '11-a-side');

-- Create fixture type enum
CREATE TYPE public.fixture_type AS ENUM ('home', 'away');

-- Create match status enum
CREATE TYPE public.match_status AS ENUM ('scheduled', 'in_progress', 'completed');

-- Create half enum
CREATE TYPE public.match_half AS ENUM ('first', 'second');

-- Create event type enum
CREATE TYPE public.event_type AS ENUM ('goal', 'assist', 'throw_in', 'corner', 'free_kick', 'penalty');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create clubs table
CREATE TABLE public.clubs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create club members table (junction table with roles)
CREATE TABLE public.club_members (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.user_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(club_id, user_id)
);

-- Create teams table
CREATE TABLE public.teams (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    team_type public.team_type NOT NULL DEFAULT '11-a-side',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create players table
CREATE TABLE public.players (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    jersey_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team players junction table
CREATE TABLE public.team_players (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(team_id, player_id)
);

-- Create fixtures table
CREATE TABLE public.fixtures (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    opponent_name TEXT NOT NULL,
    fixture_type public.fixture_type NOT NULL,
    location TEXT,
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    half_length INTEGER NOT NULL DEFAULT 25, -- in minutes
    status public.match_status NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create match events table
CREATE TABLE public.match_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
    event_type public.event_type NOT NULL,
    player_id UUID REFERENCES public.players(id), -- null for opponent events
    is_our_team BOOLEAN NOT NULL DEFAULT true,
    half public.match_half NOT NULL,
    minute INTEGER NOT NULL, -- minute in the match
    is_penalty BOOLEAN DEFAULT false, -- for penalty goals
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create player time logs table
CREATE TABLE public.player_time_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    is_starter BOOLEAN NOT NULL DEFAULT false,
    time_on INTEGER, -- minute when player came on
    time_off INTEGER, -- minute when player went off
    half public.match_half NOT NULL,
    total_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_time_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check club membership and role
CREATE OR REPLACE FUNCTION public.user_has_club_access(club_id_param UUID, required_role public.user_role DEFAULT 'viewer')
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.club_members 
    WHERE club_id = club_id_param 
    AND user_id = auth.uid()
    AND (
      role = 'admin' OR 
      (required_role = 'official' AND role IN ('admin', 'official')) OR
      (required_role = 'viewer' AND role IN ('admin', 'official', 'viewer'))
    )
  );
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for clubs
CREATE POLICY "Club members can view clubs" ON public.clubs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.club_members 
            WHERE club_id = clubs.id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated users can create clubs" ON public.clubs
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Club admins can update clubs" ON public.clubs
    FOR UPDATE USING (public.user_has_club_access(id, 'admin'));

-- RLS Policies for club_members
CREATE POLICY "Club members can view club members" ON public.club_members
    FOR SELECT USING (public.user_has_club_access(club_id, 'viewer'));

CREATE POLICY "Club admins can manage members" ON public.club_members
    FOR ALL USING (public.user_has_club_access(club_id, 'admin'));

-- RLS Policies for teams
CREATE POLICY "Club members can view teams" ON public.teams
    FOR SELECT USING (public.user_has_club_access(club_id, 'viewer'));

CREATE POLICY "Club officials can manage teams" ON public.teams
    FOR ALL USING (public.user_has_club_access(club_id, 'official'));

-- RLS Policies for players
CREATE POLICY "Club members can view players" ON public.players
    FOR SELECT USING (public.user_has_club_access(club_id, 'viewer'));

CREATE POLICY "Club officials can manage players" ON public.players
    FOR ALL USING (public.user_has_club_access(club_id, 'official'));

-- RLS Policies for team_players
CREATE POLICY "Club members can view team players" ON public.team_players
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.teams t 
            WHERE t.id = team_id AND public.user_has_club_access(t.club_id, 'viewer')
        )
    );

CREATE POLICY "Club officials can manage team players" ON public.team_players
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.teams t 
            WHERE t.id = team_id AND public.user_has_club_access(t.club_id, 'official')
        )
    );

-- RLS Policies for fixtures
CREATE POLICY "Club members can view fixtures" ON public.fixtures
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.teams t 
            WHERE t.id = team_id AND public.user_has_club_access(t.club_id, 'viewer')
        )
    );

CREATE POLICY "Club officials can manage fixtures" ON public.fixtures
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.teams t 
            WHERE t.id = team_id AND public.user_has_club_access(t.club_id, 'official')
        )
    );

-- RLS Policies for match_events
CREATE POLICY "Club members can view match events" ON public.match_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.fixtures f 
            JOIN public.teams t ON f.team_id = t.id
            WHERE f.id = fixture_id AND public.user_has_club_access(t.club_id, 'viewer')
        )
    );

CREATE POLICY "Club officials can manage match events" ON public.match_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.fixtures f 
            JOIN public.teams t ON f.team_id = t.id
            WHERE f.id = fixture_id AND public.user_has_club_access(t.club_id, 'official')
        )
    );

-- RLS Policies for player_time_logs
CREATE POLICY "Club members can view player time logs" ON public.player_time_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.fixtures f 
            JOIN public.teams t ON f.team_id = t.id
            WHERE f.id = fixture_id AND public.user_has_club_access(t.club_id, 'viewer')
        )
    );

CREATE POLICY "Club officials can manage player time logs" ON public.player_time_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.fixtures f 
            JOIN public.teams t ON f.team_id = t.id
            WHERE f.id = fixture_id AND public.user_has_club_access(t.club_id, 'official')
        )
    );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clubs_updated_at
    BEFORE UPDATE ON public.clubs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON public.teams
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON public.players
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fixtures_updated_at
    BEFORE UPDATE ON public.fixtures
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, first_name, last_name, email)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data ->> 'first_name',
        NEW.raw_user_meta_data ->> 'last_name',
        NEW.email
    );
    RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();