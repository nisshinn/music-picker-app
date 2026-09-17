export interface Track {
  id: string; // unique identifier (often spotifyTrackId or generated uuid)
  title: string;
  artist: string;
  spotifyTrackId: string; // 22-character Spotify track ID
  spotifyUrl: string; // Direct link to open on Spotify
  reason: string; // AI recommendation rationale
  genre: string;
  albumArt?: string;
  durationMs?: number;
  previewUrl?: string | null;
  tempo?: string;
  vibeKeywords?: string[];
  durationEstimate?: string;
  addedAt?: number;
}

export interface RecommendRequest {
  mood: string;
  preferredArtist?: string;
  genrePreference?: string;
  tempoPreference?: string;
  customNotes?: string;
}

export interface RecommendResponse {
  mood: string;
  preferredArtist?: string;
  curatorNote: string;
  tracks: Track[];
}

export interface FavoriteTrack extends Track {
  favoritedAt: number;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email?: string;
  images?: { url: string }[];
  product?: string; // "premium", "free", "open"
  uri?: string;
}

export interface SpotifyTokens {
  access_token: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  obtained_at?: number;
}
