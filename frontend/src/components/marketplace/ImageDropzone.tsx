'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type Preview = {
  file: File
  url: string
}

type ImageDropzoneProps = {
  files: File[]
  onChange: (files: File[]) => void
  maxFiles?: number
  existingCount?: number
  label?: string
}

export function ImageDropzone({
  files,
  onChange,
  maxFiles = 8,
  existingCount = 0,
  label = 'Billeder',
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const previews = useMemo<Preview[]>(
    () => files.map(file => ({ file, url: URL.createObjectURL(file) })),
    [files])
  const remaining = Math.max(0, maxFiles - existingCount - files.length)

  useEffect(() => {
    return () => previews.forEach(preview => URL.revokeObjectURL(preview.url))
  }, [previews])

  const addFiles = (incoming: FileList | File[]) => {
    const available = maxFiles - existingCount - files.length
    if (available <= 0) return

    const existingKeys = new Set(files.map(fileKey))
    const next = Array.from(incoming)
      .filter(file => ACCEPTED_TYPES.includes(file.type))
      .filter(file => !existingKeys.has(fileKey(file)))
      .slice(0, available)

    if (next.length > 0) onChange([...files, ...next])
  }

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-300">{label} (maks {maxFiles})</label>
      <div
        onDragEnter={e => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={e => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={e => {
          e.preventDefault()
          if (e.currentTarget === e.target) setIsDragging(false)
        }}
        onDrop={e => {
          e.preventDefault()
          setIsDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        className={`rounded-lg border border-dashed px-4 py-6 transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
        }`}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="text-sm text-gray-300">Træk billeder hertil</div>
          <div className="text-xs text-gray-500">JPG, PNG eller WEBP</div>
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={remaining <= 0}>
            Vælg billeder
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            onChange={e => {
              addFiles(e.target.files || [])
              e.currentTarget.value = ''
            }}
            className="hidden"
          />
          {existingCount > 0 && (
            <p className="text-xs text-gray-500">
              {existingCount} eksisterende, {remaining} ledige pladser
            </p>
          )}
        </div>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {previews.map((preview, index) => (
            <div key={fileKey(preview.file)} className="relative overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-sm text-white shadow hover:bg-red-700"
                aria-label="Fjern billede"
              >
                x
              </button>
              <div className="truncate px-2 py-1 text-xs text-gray-400">{preview.file.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}
