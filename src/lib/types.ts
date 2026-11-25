export type Profile = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
}

export type StrainType = 'indica' | 'sativa' | 'hybrid' | 'unknown'

export type Strain = {
  id: number
  name: string
  type: StrainType
  created_at: string
}

export type Method = 'joint' | 'blunt' | 'spliff' | 'bong' | 'pipe' | 'vape' | 'edible' | 'other'

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
  created_at: string
  profile: Profile
  strain: Strain
  people: CheckinPerson[]
  likes: { user_id: string }[]
  comments: { count: number }[]
}

export type Comment = {
  id: number
  checkin_id: number
  user_id: string
  body: string
  created_at: string
  profile: Profile
}
