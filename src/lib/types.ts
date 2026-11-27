export type Profile = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  special_badges?: string[] | null
  notifications_seen_at?: string | null
  created_at: string
}

export type StrainType = 'indica' | 'sativa' | 'hybrid' | 'unknown'

export type Strain = {
  id: number
  name: string
  type: StrainType
  created_at: string
}

export type RollStyle = 'normaal' | 'inside_out'

export type Method = 'joint' | 'voorie' | 'ringbaap' | 'blunt' | 'spliff' | 'bong' | 'pipe' | 'vape' | 'edible' | 'gummy' | 'other'

export type CheckinPerson = {
  id: number
  role: 'roller' | 'buddy'
  user_id: string | null
  name: string | null
  profile: Profile | null
}

export type Checkin = {
  id: number
  user_id: string
  strain_id: number
  method: Method
  rating: number
  bought_at: string | null
  smoked_at: string | null
  notes: string | null
  photo_path: string | null
  session_of: number | null
  /** how it was rolled: normal or inside out (only when someone rolled it) */
  roll_style?: RollStyle | null
  created_at: string
  profile: Profile
  strain: Strain
  people: CheckinPerson[]
  likes: { user_id: string; created_at?: string; profile?: Profile | null }[]
  comments: { count: number }[]
  /** other people who checked in to the same session (filled by withSessions) */
  session_mates?: Profile[]
}

export type Comment = {
  id: number
  checkin_id: number
  user_id: string
  body: string
  created_at: string
  profile: Profile
}
