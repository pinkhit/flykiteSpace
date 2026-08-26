import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  isKiteLibraryConfigured,
  listKiteDesigns,
  uploadKiteDesign,
  type KiteDesign,
} from '../lib/kiteLibrary'
import { DISCO_PALETTE } from '../game/discoPalette'

const ART_SIZE = 32
const MAX_UNDO_STEPS = 30
type KiteStudioProps = {
  currentTextureUrl: string
  onClose: () => void
  onUseDesign: (textureUrl: string) => void
}

type Tool = 'pencil' | 'eraser'

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The browser could not export this drawing.'))
    }, 'image/png')
  })
}

function drawFallbackKite(context: CanvasRenderingContext2D) {
  context.clearRect(0, 0, ART_SIZE, ART_SIZE)

  for (let y = 3; y <= 25; y += 1) {
    const halfWidth = Math.max(0, 12 - Math.abs(14 - y))
    const left = 16 - halfWidth
    const width = halfWidth * 2 + 1
    context.fillStyle = y < 14 ? '#ffdf43' : '#ed3d63'
    context.fillRect(left, y, width, 1)
  }

  context.fillStyle = '#181425'
  for (let y = 3; y <= 25; y += 1) {
    const halfWidth = Math.max(0, 12 - Math.abs(14 - y))
    context.fillRect(16 - halfWidth, y, 1, 1)
    context.fillRect(16 + halfWidth, y, 1, 1)
  }
  context.fillRect(16, 3, 1, 29)
  context.fillRect(14, 28, 5, 2)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

export function KiteStudio({
  currentTextureUrl,
  onClose,
  onUseDesign,
}: KiteStudioProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draftDataUrl = useRef<string | null>(null)
  const undoStack = useRef<ImageData[]>([])
  const lastPixel = useRef<{ x: number; y: number } | null>(null)
  const [activeTab, setActiveTab] = useState<'draw' | 'library'>('draw')
  const [artistName, setArtistName] = useState('')
  const [brushColor, setBrushColor] = useState<string>(DISCO_PALETTE[0])
  const [brushSize, setBrushSize] = useState(4)
  const [canUndo, setCanUndo] = useState(false)
  const [country, setCountry] = useState('')
  const [designs, setDesigns] = useState<KiteDesign[]>([])
  const [libraryError, setLibraryError] = useState('')
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [kiteName, setKiteName] = useState('My kite')
  const [statusMessage, setStatusMessage] = useState('')
  const [tool, setTool] = useState<Tool>('pencil')
  const [uploading, setUploading] = useState(false)

  const loadLibrary = useCallback(async () => {
    if (!isKiteLibraryConfigured) return

    setLibraryLoading(true)
    setLibraryError('')

    try {
      setDesigns(await listKiteDesigns())
    } catch (error) {
      setLibraryError(getErrorMessage(error))
    } finally {
      setLibraryLoading(false)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (activeTab !== 'draw') return

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    context.imageSmoothingEnabled = false
    const image = new Image()
    image.onload = () => {
      context.clearRect(0, 0, ART_SIZE, ART_SIZE)
      context.drawImage(image, 0, 0, ART_SIZE, ART_SIZE)
    }
    image.onerror = () => drawFallbackKite(context)
    image.src = draftDataUrl.current ?? '/kite.png'
  }, [activeTab])

  function getCanvasContext() {
    return canvasRef.current?.getContext('2d') ?? null
  }

  function rememberCanvas() {
    const context = getCanvasContext()
    if (!context) return

    undoStack.current.push(
      context.getImageData(0, 0, ART_SIZE, ART_SIZE)
    )
    if (undoStack.current.length > MAX_UNDO_STEPS) {
      undoStack.current.shift()
    }
    setCanUndo(true)
  }

  function paintPixel(x: number, y: number) {
    const context = getCanvasContext()
    if (!context) return

    const offset = Math.floor(brushSize / 2)
    const left = x - offset
    const top = y - offset

    if (tool === 'eraser') {
      context.clearRect(left, top, brushSize, brushSize)
    } else {
      context.fillStyle = brushColor
      context.fillRect(left, top, brushSize, brushSize)
    }
  }

  function getPixel(event: ReactPointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()

    return {
      x: Math.max(
        0,
        Math.min(
          ART_SIZE - 1,
          Math.floor(
            ((event.clientX - bounds.left) / bounds.width) * ART_SIZE
          )
        )
      ),
      y: Math.max(
        0,
        Math.min(
          ART_SIZE - 1,
          Math.floor(
            ((event.clientY - bounds.top) / bounds.height) * ART_SIZE
          )
        )
      ),
    }
  }

  function paintLine(from: { x: number; y: number }, to: { x: number; y: number }) {
    const distance = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y))

    for (let step = 0; step <= distance; step += 1) {
      const progress = distance === 0 ? 0 : step / distance
      paintPixel(
        Math.round(from.x + (to.x - from.x) * progress),
        Math.round(from.y + (to.y - from.y) * progress)
      )
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault()
    rememberCanvas()
    const pixel = getPixel(event)
    lastPixel.current = pixel
    paintPixel(pixel.x, pixel.y)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return

    const pixel = getPixel(event)
    if (lastPixel.current) paintLine(lastPixel.current, pixel)
    lastPixel.current = pixel
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    lastPixel.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handleUndo() {
    const context = getCanvasContext()
    const previous = undoStack.current.pop()
    if (!context || !previous) return

    context.putImageData(previous, 0, 0)
    setCanUndo(undoStack.current.length > 0)
    setStatusMessage('')
  }

  function handleClear() {
    const context = getCanvasContext()
    if (!context) return

    rememberCanvas()
    context.clearRect(0, 0, ART_SIZE, ART_SIZE)
    setStatusMessage('')
  }

  function handleUseDrawing() {
    const canvas = canvasRef.current
    if (!canvas) return

    onUseDesign(canvas.toDataURL('image/png'))
    setStatusMessage('Your drawing is now flying.')
  }

  async function handleUpload() {
    const canvas = canvasRef.current
    if (!canvas || uploading) return

    setUploading(true)
    setStatusMessage('')

    try {
      const design = await uploadKiteDesign(
        kiteName,
        artistName,
        country,
        await canvasToPng(canvas)
      )
      setDesigns((current) => [design, ...current])
      onUseDesign(design.imageUrl)
      setStatusMessage(
        'Uploaded and applied. It will become public after approval.'
      )
    } catch (error) {
      setStatusMessage(getErrorMessage(error))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="kite-studio-backdrop" role="presentation">
      <section
        aria-labelledby="kite-studio-title"
        aria-modal="true"
        className="kite-studio"
        role="dialog"
      >
        <header className="kite-studio-header">
          <h2 id="kite-studio-title">Kite Studio</h2>
          <button
            aria-label="Close kite studio"
            className="kite-studio-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="kite-studio-tabs" role="tablist">
          <button
            aria-selected={activeTab === 'draw'}
            onClick={() => setActiveTab('draw')}
            role="tab"
            type="button"
          >
            Draw
          </button>
          <button
            aria-selected={activeTab === 'library'}
            onClick={() => {
              draftDataUrl.current =
                canvasRef.current?.toDataURL('image/png') ?? null
              setActiveTab('library')
              void loadLibrary()
            }}
            role="tab"
            type="button"
          >
            Global Library
          </button>
        </div>

        {activeTab === 'draw' ? (
          <div className="kite-draw-panel">
            <div className="kite-canvas-column">
              <div className="kite-canvas-label">
                <span>draw a kite ?</span>
                <small>32 × 32 px</small>
              </div>
              <div className="kite-canvas-shell">
                <canvas
                  aria-label="32 by 32 pixel kite drawing canvas"
                  className="kite-drawing-canvas"
                  height={ART_SIZE}
                  onPointerCancel={handlePointerEnd}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerEnd}
                  ref={canvasRef}
                  width={ART_SIZE}
                />
              </div>
            </div>

            <div className="kite-drawing-controls">
              <section className="kite-control-card">
                <h3>Tools</h3>
                <div className="kite-tool-row">
                  <button
                    aria-pressed={tool === 'pencil'}
                    onClick={() => setTool('pencil')}
                    type="button"
                  >
                    Pencil
                  </button>
                  <button
                    aria-pressed={tool === 'eraser'}
                    onClick={() => setTool('eraser')}
                    type="button"
                  >
                    Eraser
                  </button>
                  <button disabled={!canUndo} onClick={handleUndo} type="button">
                    Undo
                  </button>
                  <button onClick={handleClear} type="button">
                    Clear
                  </button>
                </div>

                <div aria-label="Color palette" className="kite-palette">
                  {DISCO_PALETTE.map((color) => (
                    <button
                      aria-label={`Use color ${color}`}
                      aria-pressed={brushColor === color && tool === 'pencil'}
                      key={color}
                      onClick={() => {
                        setBrushColor(color)
                        setTool('pencil')
                      }}
                      style={{ backgroundColor: color }}
                      type="button"
                    />
                  ))}
                  <label className="kite-custom-color">
                    <span>Custom color</span>
                    <input
                      aria-label="Custom drawing color"
                      onChange={(event) => {
                        setBrushColor(event.currentTarget.value)
                        setTool('pencil')
                      }}
                      type="color"
                      value={brushColor}
                    />
                  </label>
                </div>

                <label className="kite-brush-size">
                  <span className="kite-brush-size-heading">
                    <span>Brush size</span>
                    <output>{brushSize} px</output>
                  </span>
                  <input
                    aria-label="Brush size"
                    max="16"
                    min="1"
                    onChange={(event) =>
                      setBrushSize(Number(event.currentTarget.value))
                    }
                    step="1"
                    type="range"
                    value={brushSize}
                  />
                </label>
              </section>

              <section className="kite-control-card kite-details-card">
                <h3>Kite Details</h3>
                <label className="kite-name-field">
                  Kite name
                  <input
                    maxLength={40}
                    onChange={(event) => setKiteName(event.currentTarget.value)}
                    required
                    type="text"
                    value={kiteName}
                  />
                </label>

                <label className="kite-name-field">
                  Creator name
                  <input
                    autoComplete="nickname"
                    maxLength={32}
                    onChange={(event) => setArtistName(event.currentTarget.value)}
                    placeholder="who made this kite?"
                    required
                    type="text"
                    value={artistName}
                  />
                </label>

                <label className="kite-name-field">
                  Country (optional)
                  <input
                    autoComplete="country-name"
                    maxLength={56}
                    onChange={(event) => setCountry(event.currentTarget.value)}
                    placeholder="Country"
                    type="text"
                    value={country}
                  />
                </label>
              </section>

              <div className="kite-studio-actions">
                <button onClick={handleUseDrawing} type="button">
                  fly it
                </button>
                <button
                  disabled={
                    !isKiteLibraryConfigured ||
                    !kiteName.trim() ||
                    !artistName.trim() ||
                    uploading
                  }
                  onClick={() => void handleUpload()}
                  type="button"
                >
                  {uploading ? 'Uploading…' : 'share to global library'}
                </button>
              </div>

              {!isKiteLibraryConfigured && (
                <p className="kite-studio-notice">
                  Local drawing works now. Add the Supabase environment variables
                  to enable sharing.
                </p>
              )}
              {statusMessage && (
                <p aria-live="polite" className="kite-studio-status">
                  {statusMessage}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="kite-library-panel">
            <div className="kite-library-toolbar">
              <p>Approved community kites and your pending submissions.</p>
              <button
                disabled={!isKiteLibraryConfigured || libraryLoading}
                onClick={() => void loadLibrary()}
                type="button"
              >
                Refresh
              </button>
            </div>

            <div className="kite-library-grid">
              <button
                aria-pressed={currentTextureUrl === '/kite.png'}
                className="kite-library-card"
                onClick={() => onUseDesign('/kite.png')}
                type="button"
              >
                <img alt="Frank" src="/kite.png" />
                <span>Frank</span>
              </button>

              {designs.map((design) => (
                <button
                  aria-pressed={currentTextureUrl === design.imageUrl}
                  className="kite-library-card"
                  key={design.id}
                  onClick={() => onUseDesign(design.imageUrl)}
                  type="button"
                >
                  <img alt={design.title} loading="lazy" src={design.imageUrl} />
                  <span>{design.title}</span>
                  <span className="kite-library-author">
                    by {design.artistName}
                  </span>
                  {design.country && (
                    <span className="kite-library-author">
                      {design.country}
                    </span>
                  )}
                  {design.moderationStatus !== 'approved' && (
                    <small>{design.moderationStatus}</small>
                  )}
                </button>
              ))}
            </div>

            {libraryLoading && <p>Loading kites…</p>}
            {!libraryLoading && isKiteLibraryConfigured && designs.length === 0 && (
              <p>No community kites yet. Draw the first one.</p>
            )}
            {!isKiteLibraryConfigured && (
              <p className="kite-studio-notice">
                Connect Supabase to load the global library.
              </p>
            )}
            {libraryError && (
              <p aria-live="polite" className="kite-studio-error">
                {libraryError}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
