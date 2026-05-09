import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default function scrapeWhiskyPlugin() {
  return {
    name: 'scrape-whisky',
    configureServer(server) {
      server.middlewares.use('/api/scrape-whisky', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405)
          res.end('Method Not Allowed')
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')

          let url
          try {
            const parsed = JSON.parse(body)
            url = parsed.url
          } catch {
            res.writeHead(400)
            res.end(JSON.stringify({ error: 'Invalid JSON' }))
            return
          }

          if (!url) {
            res.writeHead(400)
            res.end(JSON.stringify({ error: 'Missing url' }))
            return
          }

          const env = {
            ...process.env,
            SUPABASE_URL:         process.env.VITE_SUPABASE_URL,
            SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
            GEMINI_KEY:            process.env.VITE_GEMINI_KEY,
          }

          const script = path.join(__dirname, 'scripts/scrape-whisky.js')

          const child = spawn('node', [script, url], {
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
          })

          let stdout = ''
          let stderr = ''

          child.stdout.on('data', d => { stdout += d.toString() })
          child.stderr.on('data', d => { stderr += d.toString() })

          const exit = await new Promise(r => child.on('close', r))

          const output = stdout + stderr

          if (exit === 0) {
            const nameMatch = stdout.match(/name="([^"]+)"/) ||
                              stdout.match(/"name"\s*:\s*"([^"]+)"/) ||
                              stdout.match(/Added to catalogue:\s*"?([^"]+)"?/)
            const name = nameMatch ? nameMatch[1] : null

            const isDuplicate = /already exists/i.test(output)

            res.writeHead(200)
            res.end(JSON.stringify({ success: true, name, duplicate: isDuplicate }))
          } else {
            const errorMsg = stderr || stdout || 'Unknown error'
            res.writeHead(500)
            res.end(JSON.stringify({ error: errorMsg.trim() }))
          }
        })
      })
    },
  }
}