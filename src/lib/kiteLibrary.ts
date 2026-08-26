import { createClient, type User } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim()

export const isKiteLibraryConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
)

const supabase = isKiteLibraryConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null

export type KiteDesign = {
  artistName: string
  country: string | null
  id: string
  imageUrl: string
  moderationStatus: 'approved' | 'pending' | 'rejected'
  title: string
}

type KiteRow = {
  artist_name: string
  country: string | null
  id: string
  image_path: string
  moderation_status: KiteDesign['moderationStatus']
  title: string
}

function createUuid() {
  const cryptoApi = globalThis.crypto

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }

  const bytes = new Uint8Array(16)

  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  )

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'The global library is not configured yet. Add the Supabase environment variables first.'
    )
  }

  return supabase
}

async function getOrCreateAnonymousUser(): Promise<User> {
  const client = requireSupabase()
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession()

  if (sessionError) throw sessionError
  if (session?.user) return session.user

  const { data, error } = await client.auth.signInAnonymously()

  if (error) throw error
  if (!data.user) throw new Error('Supabase did not create a user session.')

  return data.user
}

function toKiteDesign(row: KiteRow): KiteDesign {
  const client = requireSupabase()
  const { data } = client.storage.from('kite-art').getPublicUrl(row.image_path)

  return {
    artistName: row.artist_name,
    country: row.country,
    id: row.id,
    imageUrl: data.publicUrl,
    moderationStatus: row.moderation_status,
    title: row.title,
  }
}

export async function listKiteDesigns(): Promise<KiteDesign[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('kites')
    .select(
      'id, title, artist_name, country, image_path, moderation_status'
    )
    .order('created_at', { ascending: false })
    .limit(60)

  if (error) throw error

  return (data as KiteRow[]).map(toKiteDesign)
}

export async function uploadKiteDesign(
  title: string,
  artistName: string,
  country: string,
  image: Blob
): Promise<KiteDesign> {
  const client = requireSupabase()
  const user = await getOrCreateAnonymousUser()
  const normalizedTitle = title.trim()
  const normalizedArtistName = artistName.trim()
  const normalizedCountry = country.trim() || null

  if (!normalizedTitle || normalizedTitle.length > 40) {
    throw new Error('Give your kite a name between 1 and 40 characters.')
  }

  if (!normalizedArtistName || normalizedArtistName.length > 32) {
    throw new Error('Give the creator a public name between 1 and 32 characters.')
  }

  if (normalizedCountry && normalizedCountry.length > 56) {
    throw new Error('Country must be 56 characters or fewer.')
  }

  if (image.type !== 'image/png' || image.size > 256 * 1024) {
    throw new Error('Kite art must be a PNG smaller than 256 KB.')
  }

  const imagePath = `${user.id}/${createUuid()}.png`
  const { error: uploadError } = await client.storage
    .from('kite-art')
    .upload(imagePath, image, {
      cacheControl: '31536000',
      contentType: 'image/png',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { data, error: insertError } = await client
    .from('kites')
    .insert({
      artist_name: normalizedArtistName,
      country: normalizedCountry,
      image_path: imagePath,
      moderation_status: 'pending',
      owner_id: user.id,
      title: normalizedTitle,
    })
    .select(
      'id, title, artist_name, country, image_path, moderation_status'
    )
    .single()

  if (insertError) {
    await client.storage.from('kite-art').remove([imagePath])
    throw insertError
  }

  return toKiteDesign(data as KiteRow)
}
