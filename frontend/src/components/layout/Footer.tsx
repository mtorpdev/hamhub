export function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📡</span>
            <span className="text-white font-bold">HamHub</span>
            <span className="text-gray-500 text-sm ml-2">Moderne amatørradio community</span>
          </div>
          <div className="text-gray-500 text-sm">
            73 de HamHub &bull; {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </footer>
  )
}
