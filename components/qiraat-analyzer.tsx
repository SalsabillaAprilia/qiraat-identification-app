"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import WaveSurfer from "wavesurfer.js"
import { PredictionResult } from "./prediction-result"

type Prediction = {
  label: string
  confidence: number
}

type HistoryItem = {
  id: string
  name: string
  result?: Prediction
  error?: string
  at: number
}

export function QiraatAnalyzer() {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const waveSurferRef = React.useRef<WaveSurfer | null>(null)

  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [isRecording, setIsRecording] = React.useState(false)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [result, setResult] = React.useState<Prediction | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [history, setHistory] = React.useState<HistoryItem[]>([])

  // Init WaveSurfer once
  React.useEffect(() => {
    if (!containerRef.current || waveSurferRef.current) return

    const styles = getComputedStyle(document.documentElement)
    const waveColor = styles.getPropertyValue("--color-muted-foreground")?.trim() || "#6b7280"
    const progressColor = styles.getPropertyValue("--color-primary")?.trim() || "#10b981"

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor,
      progressColor,
      cursorColor: progressColor,
      height: 96,
      barWidth: 2,
      barGap: 1,
      responsive: true,
    })

    ws.on("play", () => setIsPlaying(true))
    ws.on("pause", () => setIsPlaying(false))
    ws.on("finish", () => setIsPlaying(false))

    waveSurferRef.current = ws

    return () => {
      ws.destroy()
      waveSurferRef.current = null
    }
  }, [])

  // Load audio when URL changes
  React.useEffect(() => {
    if (audioUrl && waveSurferRef.current) {
      waveSurferRef.current.load(audioUrl)
    }
  }, [audioUrl])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    setError(null)
    setAudioBlob(file)
    setFileName(file.name)
    const url = URL.createObjectURL(file)
    setAudioUrl(url)
  }

  async function identify() {
    if (!audioBlob) {
      alert("Silakan unggah audio terlebih dahulu.")
      return
    }
    setIsLoading(true)
    setResult(null)
    setError(null)
    try {
      const file = new File([audioBlob], fileName || (audioBlob.type.includes("webm") ? "rekaman.webm" : "audio.wav"), {
        type: audioBlob.type || "audio/wav",
      })
      const fd = new FormData()
      fd.append("file", file)

      const res = await fetch("/api/predict", {
        method: "POST",
        body: fd,
      })
      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        const message = (payload && (payload.error as string)) || `HTTP ${res.status}`
        setError(message)
        setHistory((h) =>
          [{ id: crypto.randomUUID(), name: file.name, error: message, at: Date.now() }, ...h].slice(0, 3),
        )
        return
      }

      const data = payload as Prediction
      setResult(data)
      setHistory((h) => [{ id: crypto.randomUUID(), name: file.name, result: data, at: Date.now() }, ...h].slice(0, 3))
    } catch (err) {
      console.error("[v0] Gagal identifikasi:", err)
      setError("Terjadi kesalahan saat mengidentifikasi audio.")
      setHistory((h) =>
        [
          {
            id: crypto.randomUUID(),
            name: fileName || "audio",
            error: "Terjadi kesalahan saat mengidentifikasi audio.",
            at: Date.now(),
          },
          ...h,
        ].slice(0, 3),
      )
    } finally {
      setIsLoading(false)
    }
  }

  function togglePlay() {
    if (waveSurferRef.current) {
      waveSurferRef.current.playPause()
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="inline-block">
          <span className="sr-only">Unggah berkas audio</span>
          <input
            type="file"
            accept="audio/*,.mp3,.wav"
            onChange={handleFileChange}
            className="hidden"
            id="file-input-audio"
          />
          <Button asChild className="w-full sm:w-auto">
            <span>
              <label htmlFor="file-input-audio" className="cursor-pointer">
                Unggah Audio
              </label>
            </span>
          </Button>
        </label>

        <Button onClick={identify} disabled={!audioBlob || isLoading} className="w-full sm:w-auto">
          {isLoading ? "Mengidentifikasi..." : "Identifikasi"}
        </Button>
      </div>

      <div className="rounded-lg border bg-muted/50 p-4">
        <div ref={containerRef} className="rounded-md bg-muted/70" aria-label="Visualisasi gelombang audio" />
        <div className="mt-3 flex items-center gap-2">
          <Button variant="outline" onClick={togglePlay} disabled={!audioUrl} aria-pressed={isPlaying}>
            {isPlaying ? "Jeda" : "Putar"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {audioUrl
              ? fileName
                ? `Siap diputar: ${fileName}`
                : "Audio siap diputar."
              : "Unggah audio untuk melihat waveform."}
          </p>
        </div>
      </div>

      <PredictionResult result={result} error={error} tone="success" />

      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium">Riwayat Analisis</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Belum ada analisis. Unggah audio untuk mulai.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 rounded-md bg-accent/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{h.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{new Date(h.at).toLocaleString()}</p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  {h.error ? (
                    <span className="text-destructive-foreground">Gagal</span>
                  ) : (
                    <span className="text-primary">
                      {h.result?.label} ({Math.round((h.result?.confidence ?? 0) * 100)}%)
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
