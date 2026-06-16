// Vercel serverless function — cloud feedback store (likes/dislikes/notes/schedule).
// Persists to feedback.json in the GitHub repo via the Contents API.
// Env (set on Vercel, NOT sensitive): GH_TOKEN, GH_REPO, FB_PATH, GH_BRANCH
const clean = (s) => (s || '').replace(/[﻿​\r\n\t]/g, '').trim()
const REPO = clean(process.env.GH_REPO) || 'Brutalxnor/ig-content-dashboard'
const TOKEN = clean(process.env.GH_TOKEN)
const FB_PATH = clean(process.env.FB_PATH) || 'feedback.json'
const BRANCH = clean(process.env.GH_BRANCH) || 'main'
const API = `https://api.github.com/repos/${REPO}/contents/${FB_PATH}`
const H = { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'igc-dashboard', Accept: 'application/vnd.github+json' }
const EMPTY = { feedback: {}, schedule: {} }

async function ghGet() {
  const r = await fetch(`${API}?ref=${BRANCH}&t=${Date.now()}`, { headers: H })
  if (r.status === 404) return { data: EMPTY, sha: null }
  if (!r.ok) throw new Error('get ' + r.status + ' ' + (await r.text()))
  const j = await r.json()
  const content = Buffer.from(j.content, 'base64').toString('utf-8')
  let data; try { data = JSON.parse(content) } catch { data = EMPTY }
  return { data: { ...EMPTY, ...data }, sha: j.sha }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!TOKEN) return res.status(500).json({ error: 'GH_TOKEN not configured' })
  try {
    if (req.method === 'GET') {
      const { data } = await ghGet()
      return res.status(200).json(data)
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}')
      const { sha } = await ghGet()
      const payload = { feedback: body.feedback || {}, schedule: body.schedule || {} }
      const content = Buffer.from(JSON.stringify(payload, null, 1)).toString('base64')
      const put = await fetch(API, {
        method: 'PUT', headers: H,
        body: JSON.stringify({ message: 'update feedback', content, sha: sha || undefined, branch: BRANCH }),
      })
      if (!put.ok) return res.status(500).json({ error: await put.text() })
      return res.status(200).json({ ok: true })
    }
    return res.status(405).end()
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
