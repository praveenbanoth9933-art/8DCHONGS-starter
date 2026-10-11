import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import type { User } from '@supabase/supabase-js'
import { AudioLines, Search, Home, Compass, Heart, ListMusic, LogIn, LogOut, Play, Pause, SkipBack, SkipForward, Volume2, Upload, Music2, ShieldCheck, X, Disc3 } from 'lucide-react'

type Song = {
  id: string
  title: string
  artist: string
  genre: string
  cover_url: string | null
  audio_path: string
  published: boolean
  created_at?: string
}
type Profile = { id: string; role: 'user' | 'admin'; display_name: string | null }
type Favorite = { song_id: string }

const demoSongs: Song[] = [
  { id: 'demo-1', title: 'Midnight Drive', artist: '8DCHONGS Demo', genre: 'Electronic', cover_url: null, audio_path: '', published: true },
  { id: 'demo-2', title: 'Ocean Dreams', artist: '8DCHONGS Demo', genre: 'Instrumental', cover_url: null, audio_path: '', published: true },
  { id: 'demo-3', title: 'Neon Memories', artist: '8DCHONGS Demo', genre: 'Chill', cover_url: null, audio_path: '', published: true },
  { id: 'demo-4', title: 'Rainy Evening', artist: '8DCHONGS Demo', genre: 'Ambient', cover_url: null, audio_path: '', published: true },
]

const genres = ['All', 'Telugu', 'Hindi', 'English', 'Tamil', 'Instrumental', 'Classical', 'Devotional', 'Electronic', 'Independent', '8D / Reverb']

function coverStyle(index: number) {
  const gradients = [
    'linear-gradient(135deg,#3b0764,#db2777)',
    'linear-gradient(135deg,#082f49,#06b6d4)',
    'linear-gradient(135deg,#312e81,#9333ea)',
    'linear-gradient(135deg,#3f1d0b,#f59e0b)',
    'linear-gradient(135deg,#064e3b,#84cc16)',
    'linear-gradient(135deg,#7f1d1d,#fb7185)',
  ]
  return { background: gradients[index % gradients.length] }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [songs, setSongs] = useState<Song[]>(demoSongs)
  const [favorites, setFavorites] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('All')
  const [page, setPage] = useState<'Home' | 'Explore' | 'Favorites' | 'Admin'>('Home')
  const [current, setCurrent] = useState<Song | null>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function load() {
      if (!supabase) return
      const { data, error } = await supabase.from('songs').select('*').eq('published', true).order('created_at', { ascending: false })
      if (!error && data) setSongs(data as Song[])
    }
    load()
  }, [user])

  useEffect(() => {
    async function loadUserData() {
      if (!supabase || !user) { setProfile(null); setFavorites([]); return }
      const [{ data: p }, { data: f }] = await Promise.all([
        supabase.from('profiles').select('id, role, display_name').eq('id', user.id).maybeSingle(),
        supabase.from('favorites').select('song_id').eq('user_id', user.id),
      ])
      setProfile((p as Profile | null) ?? null)
      setFavorites((f as Favorite[] | null)?.map(row => row.song_id) ?? [])
    }
    loadUserData()
  }, [user])

  useEffect(() => {
    if (current?.audio_path && supabase && !current.audio_path.startsWith('http')) {
      const { data } = supabase.storage.from('music').getPublicUrl(current.audio_path)
      if (audioRef.current) audioRef.current.src = data.publicUrl
    } else if (current?.audio_path && audioRef.current) {
      audioRef.current.src = current.audio_path
    } else if (audioRef.current) {
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
      setPlaying(false)
    }
  }, [current])

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume }, [volume])
  useEffect(() => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.play().catch(() => { setPlaying(false); setMessage('This track could not play. Check its authorized audio file URL.') })
    } else audioRef.current.pause()
  }, [playing, current])

  const visibleSongs = useMemo(() => songs.filter(song => {
    const text = `${song.title} ${song.artist} ${song.genre}`.toLowerCase()
    return text.includes(query.toLowerCase()) && (genre === 'All' || song.genre.toLowerCase() === genre.toLowerCase())
  }), [songs, query, genre])

  async function handleAuth(e: FormEvent) {
    e.preventDefault()
    if (!supabase) { setMessage('Connect Supabase first using the setup steps in README.md.'); return }
    setBusy(true); setMessage('')
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Account created. If email confirmation is enabled, check your inbox to confirm it.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setAuthOpen(false); setPassword('')
      }
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Authentication failed.') }
    finally { setBusy(false) }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    setPage('Home'); setMessage('Signed out.')
  }

  async function toggleFavorite(song: Song) {
    if (song.id.startsWith('demo-')) { setMessage('Connect Supabase and add a real song before saving favorites.'); return }
    if (!supabase || !user) { setAuthOpen(true); setMessage('Sign in to save favorites.'); return }
    const isFavorite = favorites.includes(song.id)
    const result = isFavorite
      ? await supabase.from('favorites').delete().eq('user_id', user.id).eq('song_id', song.id)
      : await supabase.from('favorites').insert({ user_id: user.id, song_id: song.id })
    if (result.error) setMessage(result.error.message)
    else setFavorites(old => isFavorite ? old.filter(id => id !== song.id) : [...old, song.id])
  }

  async function uploadSong(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase || !user || profile?.role !== 'admin') { setMessage('Admin access required.'); return }
    const form = e.currentTarget
    const fd = new FormData(form)
    const audio = fd.get('audio') as File
    const cover = fd.get('cover') as File
    const title = String(fd.get('title') || '').trim()
    const artist = String(fd.get('artist') || '').trim()
    const selectedGenre = String(fd.get('genre') || 'Independent')
    if (!audio || !audio.size || !title || !artist) { setMessage('Choose an audio file and enter title and artist.'); return }
    if (audio.size > 25 * 1024 * 1024) { setMessage('Prototype upload limit: 25 MB per audio file.'); return }
    setBusy(true); setMessage('')
    try {
      const safeName = audio.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-')
      const audioPath = `${crypto.randomUUID()}-${safeName}`
      const { error: audioError } = await supabase.storage.from('music').upload(audioPath, audio, { upsert: false, contentType: audio.type || 'audio/mpeg' })
      if (audioError) throw audioError
      let coverUrl: string | null = null
      if (cover && cover.size) {
        if (cover.size > 5 * 1024 * 1024) throw new Error('Cover image must be under 5 MB.')
        const coverPath = `${crypto.randomUUID()}-${cover.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-')}`
        const { error: coverError } = await supabase.storage.from('covers').upload(coverPath, cover, { upsert: false })
        if (coverError) throw coverError
        coverUrl = supabase.storage.from('covers').getPublicUrl(coverPath).data.publicUrl
      }
      const { data, error } = await supabase.from('songs').insert({ title, artist, genre: selectedGenre, audio_path: audioPath, cover_url: coverUrl, published: true, uploaded_by: user.id }).select().single()
      if (error) throw error
      setSongs(old => [data as Song, ...old]); form.reset(); setMessage('Track uploaded and published.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Upload failed. Check Storage policies.') }
    finally { setBusy(false) }
  }

  async function deleteSong(song: Song) {
    if (!supabase || profile?.role !== 'admin') return
    if (!window.confirm(`Delete "${song.title}" from the catalogue?`)) return
    const { error } = await supabase.from('songs').delete().eq('id', song.id)
    if (error) setMessage(error.message)
    else { setSongs(old => old.filter(s => s.id !== song.id)); if (current?.id === song.id) { setCurrent(null); setPlaying(false) } }
  }

  function playSong(song: Song) {
    if (!song.audio_path) { setMessage('This is a demo card. Add a licensed audio file in the Admin panel to enable playback.'); return }
    setCurrent(song); setPlaying(true); setMessage('')
  }
  function playNext(direction: number) {
    const list = visibleSongs.length ? visibleSongs : songs
    if (!list.length) return
    const index = Math.max(0, list.findIndex(s => s.id === current?.id))
    const next = list[(index + direction + list.length) % list.length]
    if (next) playSong(next)
  }

  const shownSongs = page === 'Favorites' ? visibleSongs.filter(s => favorites.includes(s.id)) : visibleSongs

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => { setPage('Home'); setGenre('All') }}><span className="brand-mark"><AudioLines size={25}/></span><span>8D<span className="brand-accent">CHONGS</span><small>FEEL EVERY DIMENSION</small></span></button>
      <div className="side-label">MENU</div>
      <button className={`nav-item ${page === 'Home' ? 'active' : ''}`} onClick={() => setPage('Home')}><Home size={18}/> Home</button>
      <button className={`nav-item ${page === 'Explore' ? 'active' : ''}`} onClick={() => setPage('Explore')}><Compass size={18}/> Explore</button>
      <button className={`nav-item ${page === 'Favorites' ? 'active' : ''}`} onClick={() => setPage('Favorites')}><Heart size={18}/> Favorites</button>
      {profile?.role === 'admin' && <button className={`nav-item ${page === 'Admin' ? 'active' : ''}`} onClick={() => setPage('Admin')}><ShieldCheck size={18}/> Admin panel</button>}
      <div className="sidebar-bottom"><div className="mini-note"><Disc3 size={19}/><span>Good sound.<br/><b>Good energy.</b></span></div><span className="copyright">© 8DCHONGS</span></div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="searchbox"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search songs, artists, genres..." aria-label="Search music"/></div>
        <div className="account-actions">
          {user ? <><span className="user-email">{user.email}</span><button className="icon-btn" title="Sign out" onClick={signOut}><LogOut size={18}/></button></> : <button className="primary-btn small" onClick={() => { setAuthOpen(true); setAuthMode('login') }}><LogIn size={16}/> Sign in</button>}
        </div>
      </header>

      {!isSupabaseConfigured && <div className="setup-banner"><b>Setup mode:</b> UI preview is running. Follow README.md to connect Supabase for real accounts, database and uploads.</div>}
      {message && <div className="toast" role="status">{message}<button onClick={() => setMessage('')} aria-label="Dismiss message"><X size={15}/></button></div>}

      {page === 'Admin' && profile?.role === 'admin' ? <section className="content admin-content">
        <div className="eyebrow"><ShieldCheck size={15}/> ADMIN STUDIO</div><h1>Upload a new <span>track.</span></h1><p className="muted">Only accounts explicitly promoted to admin in the database can upload or delete tracks.</p>
        <form className="upload-form" onSubmit={uploadSong}>
          <label>Song title<input name="title" required placeholder="e.g. Midnight Drive"/></label>
          <label>Artist name<input name="artist" required placeholder="Artist or creator"/></label>
          <label>Genre<select name="genre">{genres.filter(g => g !== 'All').map(g => <option key={g}>{g}</option>)}</select></label>
          <label>Audio file (MP3, WAV, OGG; max 25 MB)<input name="audio" type="file" accept="audio/*" required/></label>
          <label>Cover image (optional; max 5 MB)<input name="cover" type="file" accept="image/*"/></label>
          <button className="primary-btn" disabled={busy}><Upload size={17}/>{busy ? 'Uploading…' : 'Upload and publish'}</button>
          <p className="tiny muted">Upload only tracks you own or have permission to distribute. Prototype upload limits are intentionally small.</p>
        </form>
        <h2 className="section-title">Manage catalogue <span>{songs.length} tracks</span></h2>
        <div className="admin-list">{songs.filter(s => !s.id.startsWith('demo-')).map(s => <div className="admin-row" key={s.id}><Music2 size={18}/><span>{s.title}<small>{s.artist} · {s.genre}</small></span><button className="danger-btn" onClick={() => deleteSong(s)}>Delete</button></div>)}</div>
      </section> : <section className="content">
        {page === 'Home' && <div className="hero">
          <div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> YOUR SOUND. YOUR WORLD.</div><h1>Feel music in<br/><span>every dimension.</span></h1><p>Discover your next favourite track. From Telugu melodies to electronic beats, find the sound that moves you.</p><button className="primary-btn" onClick={() => { setPage('Explore'); document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' }) }}><Play size={17} fill="currentColor"/> Explore music</button><div className="hero-tags"><span>✦ All genres</span><span>✦ New discoveries</span><span>✦ Your vibe</span></div></div>
          <div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-disc"><AudioLines size={74}/><span>8D</span></div><div className="float-tag tag-top">SPATIAL VIBES</div><div className="float-tag tag-bottom"><span className="live-dot"/> SOUND ON</div></div>
        </div>}
        {page === 'Explore' && <div className="page-heading"><div className="eyebrow">FIND YOUR NEXT FAVOURITE</div><h1>Explore <span>sounds.</span></h1><p className="muted">A little bit of everything, made for every mood.</p></div>}
        {page === 'Favorites' && <div className="page-heading"><div className="eyebrow">YOUR PERSONAL COLLECTION</div><h1>Liked <span>tracks.</span></h1><p className="muted">Your favourites, all in one place. Sign in to save tracks across devices.</p></div>}
        <div id="catalogue" className="catalogue-heading"><div><div className="eyebrow">{page === 'Favorites' ? 'SAVED BY YOU' : page === 'Explore' ? 'BROWSE BY MOOD' : 'PICK YOUR NEXT VIBE'}</div><h2 className="section-title">{page === 'Favorites' ? 'Your favourites' : 'Made for your mood'} <span>{shownSongs.length} tracks</span></h2></div><button className="text-btn" onClick={() => { setPage('Explore'); setGenre('All') }}>View all <span>↗</span></button></div>
        <div className="genre-row">{genres.map(g => <button key={g} className={`genre-chip ${genre === g ? 'selected' : ''}`} onClick={() => { setGenre(g); if (page === 'Home') setPage('Explore') }}>{g}</button>)}</div>
        <div className="song-grid">
          {shownSongs.map((song, i) => <article className="song-card" key={song.id}>
            <div className="cover-art" style={song.cover_url ? { backgroundImage: `url("${song.cover_url}")` } : coverStyle(i)}>{!song.cover_url && <><AudioLines size={40}/><span className="cover-word">8DCHONGS</span></>}<button className="cover-play" onClick={() => playSong(song)} aria-label={`Play ${song.title}`}><Play size={19} fill="currentColor"/></button><button className={`heart-btn ${favorites.includes(song.id) ? 'liked' : ''}`} onClick={() => toggleFavorite(song)} aria-label="Toggle favorite"><Heart size={17} fill={favorites.includes(song.id) ? 'currentColor' : 'none'}/></button></div>
            <div className="song-meta"><div><h3>{song.title}</h3><p>{song.artist}</p></div><span className="genre-label">{song.genre}</span></div>
          </article>)}
          {shownSongs.length === 0 && <div className="empty-state"><ListMusic size={34}/><h3>No tracks found yet</h3><p>Add licensed audio in the Admin panel, or try another search or genre.</p></div>}
        </div>
        {page === 'Home' && <div className="legal-note"><ShieldCheck size={18}/><span><b>Music with permission.</b> 8DCHONGS should stream only music you own or are licensed to distribute.</span></div>}
      </section>}
      <footer className="footer"><span>© 8DCHONGS · Music for every mood.</span><span>Made for the love of sound.</span></footer>
    </main>

    <div className="player">
      <audio ref={audioRef} onTimeUpdate={e => setPosition(e.currentTarget.currentTime)} onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)} onEnded={() => playNext(1)} />
      <div className="now-playing"><div className="mini-cover"><AudioLines size={20}/></div><div className="now-text"><b>{current?.title ?? 'Choose a track'}</b><span>{current?.artist ?? 'Your next favourite is waiting'}</span></div></div>
      <div className="player-center"><div className="player-controls"><button className="player-btn" onClick={() => playNext(-1)} aria-label="Previous track"><SkipBack size={18} fill="currentColor"/></button><button className="play-main" onClick={() => current?.audio_path ? setPlaying(v => !v) : setMessage('Choose a track with an authorized audio file first.')} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}</button><button className="player-btn" onClick={() => playNext(1)} aria-label="Next track"><SkipForward size={18} fill="currentColor"/></button></div><div className="timeline"><span>{formatTime(position)}</span><input aria-label="Playback position" type="range" min="0" max={duration || 100} value={Math.min(position, duration || 100)} onChange={e => { const v = Number(e.target.value); if (audioRef.current) audioRef.current.currentTime = v; setPosition(v) }}/><span>{formatTime(duration)}</span></div></div>
      <div className="player-volume"><Volume2 size={18}/><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(Number(e.target.value))}/></div>
    </div>

    {authOpen && <div className="modal-backdrop" onClick={() => setAuthOpen(false)}><div className="auth-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close"><X size={19}/></button><div className="auth-logo"><AudioLines size={27}/></div><h2>{authMode === 'login' ? 'Welcome back.' : 'Join the sound.'}</h2><p className="muted">{authMode === 'login' ? 'Sign in to your 8DCHONGS account.' : 'Create an account to save your favourites.'}</p><form onSubmit={handleAuth}><label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/></label><button className="primary-btn full" disabled={busy}>{busy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button></form>{message && <p className="modal-message">{message}</p>}<p className="switch-auth">{authMode === 'login' ? "New to 8DCHONGS?" : 'Already have an account?'} <button onClick={() => { setAuthMode(v => v === 'login' ? 'signup' : 'login'); setMessage('') }}>{authMode === 'login' ? 'Create account' : 'Sign in'}</button></p></div></div>}
  </div>
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}