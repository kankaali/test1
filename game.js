const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

canvas.width = innerWidth
canvas.height = innerHeight

// ================= CORE =================
const CENTER = { x: canvas.width / 2, y: canvas.height * 0.28 }
const CORE_RADIUS = 26

// ================= PHYSICS =================
const G = 0.45                     // stronger inward pull
const SOFTEN = 1100

// angular momentum barrier (creates real orbit bowl)
const L_BARRIER = 2400

const BASE_DAMP = 0.9985
const SURFACE_DAMP = 0.94

// fluid shell between orbit & surface
const CRIT_RADIUS = CORE_RADIUS + 36
const CRIT_WIDTH  = 26

// ================= LAUNCH =================
const LAUNCH_SCALE = 0.045
const MAX_LAUNCH_IMPULSE = 7.2

// ================= GAME =================
let balls = []
let currentBall = null
let nextLevel = randLevel()

let aiming = false
let aimStart = null
let aimNow = null

// ================= BALL =================
function createBall(x, y, lvl, vx = 0, vy = 0) {
  const r = 22 + lvl * 6
  return {
    pos: { x, y },
    vel: { x: vx, y: vy },
    r,
    lvl,
    surface: false,
    drift: (Math.random() - 0.5) * 0.00045
  }
}

// ================= SPAWN =================
function spawn() {
  currentBall = createBall(
    canvas.width / 2,
    canvas.height - 82,
    nextLevel
  )
  nextLevel = randLevel()
}

// ================= PHYSICS =================
function applyPhysics(b) {
  const rx = b.pos.x - CENTER.x
  const ry = b.pos.y - CENTER.y
  const r2 = rx * rx + ry * ry + 0.0001
  const r  = Math.sqrt(r2)

  const nx = rx / r
  const ny = ry / r

  // decompose velocity
  const vr = b.vel.x * nx + b.vel.y * ny
  const tx = -ny
  const ty = nx
  const vt = b.vel.x * tx + b.vel.y * ty

  // gravity + angular momentum barrier
  const g = -G / (r2 + SOFTEN)
  const barrier = (vt * vt) * L_BARRIER / (r2 * r)

  let newVr = vr + g + barrier
  let newVt = vt * BASE_DAMP

  // -------- FLUID DAMPING SHELL --------
  if (r < CRIT_RADIUS + CRIT_WIDTH) {
    const t = Math.min(1, (CRIT_RADIUS + CRIT_WIDTH - r) / CRIT_WIDTH)
    newVr *= (1 - 0.95 * t)
    newVt *= (1 - 0.35 * t)
  }

  // -------- BLACKHOLE SURFACE --------
  const surfaceDist = CORE_RADIUS + b.r
  if (r <= surfaceDist) {
    b.surface = true

    if (newVr < 0) newVr = 0
    newVt *= SURFACE_DAMP
    newVt += b.drift

    b.vel.x = tx * newVt
    b.vel.y = ty * newVt

    b.pos.x = CENTER.x + nx * surfaceDist
    b.pos.y = CENTER.y + ny * surfaceDist
  } else {
    b.surface = false
    b.vel.x = nx * newVr + tx * newVt
    b.vel.y = ny * newVr + ty * newVt
  }

  b.pos.x += b.vel.x
  b.pos.y += b.vel.y
}

// ================= COLLISIONS =================
function resolveCollisions() {
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i]
      const b = balls[j]

      const dx = b.pos.x - a.pos.x
      const dy = b.pos.y - a.pos.y
      const d = Math.hypot(dx, dy)
      const min = a.r + b.r

      if (d < min && d > 0) {
        const nx = dx / d
        const ny = dy / d
        const overlap = min - d

        a.pos.x -= nx * overlap * 0.5
        a.pos.y -= ny * overlap * 0.5
        b.pos.x += nx * overlap * 0.5
        b.pos.y += ny * overlap * 0.5

        if (a.lvl === b.lvl) {
          merge(a, b)
          return
        }
      }
    }
  }
}

// ================= MERGE =================
function merge(a, b) {
  balls = balls.filter(x => x !== a && x !== b)
  balls.push(createBall(
    (a.pos.x + b.pos.x) / 2,
    (a.pos.y + b.pos.y) / 2,
    a.lvl + 1
  ))
}

// ================= TRAJECTORY =================
function drawTrajectory() {
  if (!aiming) return

  let pos = { ...currentBall.pos }

  let ix = (aimStart.x - aimNow.x) * LAUNCH_SCALE
  let iy = (aimStart.y - aimNow.y) * LAUNCH_SCALE
  const mag = Math.hypot(ix, iy)
  if (mag > MAX_LAUNCH_IMPULSE) {
    ix *= MAX_LAUNCH_IMPULSE / mag
    iy *= MAX_LAUNCH_IMPULSE / mag
  }

  let vel = { x: ix, y: iy }

  for (let i = 0; i < 180; i++) {
    const fake = {
      pos: { ...pos },
      vel: { ...vel },
      r: currentBall.r,
      drift: 0,
      surface: false
    }

    applyPhysics(fake)
    pos = fake.pos
    vel = fake.vel

    ctx.fillStyle = `rgba(255,255,255,${1 - i / 180})`
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ================= DRAW =================
function drawBall(b) {
  ctx.fillStyle = color(b.lvl)
  ctx.beginPath()
  ctx.arc(b.pos.x, b.pos.y, b.r, 0, Math.PI * 2)
  ctx.fill()
}

function drawCore() {
  ctx.fillStyle = "#000"
  ctx.beginPath()
  ctx.arc(CENTER.x, CENTER.y, CORE_RADIUS, 0, Math.PI * 2)
  ctx.fill()
}

function color(l) {
  return ["#4dd0e1","#81c784","#ffd54f","#ff8a65","#ba68c8","#f06292"][l] || "#eee"
}

// ================= LOOP =================
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  balls.forEach(applyPhysics)
  resolveCollisions()

  drawCore()
  balls.forEach(drawBall)
  if (currentBall) drawBall(currentBall)

  drawTrajectory()
  requestAnimationFrame(loop)
}

// ================= INPUT =================
canvas.addEventListener("touchstart", e => {
  aiming = true
  const t = e.touches[0]
  aimStart = { x: t.clientX, y: t.clientY }
  aimNow = aimStart
})

canvas.addEventListener("touchmove", e => {
  if (!aiming) return
  const t = e.touches[0]
  aimNow = { x: t.clientX, y: t.clientY }
})

canvas.addEventListener("touchend", () => {
  if (!aiming) return

  let ix = (aimStart.x - aimNow.x) * LAUNCH_SCALE
  let iy = (aimStart.y - aimNow.y) * LAUNCH_SCALE
  const mag = Math.hypot(ix, iy)
  if (mag > MAX_LAUNCH_IMPULSE) {
    ix *= MAX_LAUNCH_IMPULSE / mag
    iy *= MAX_LAUNCH_IMPULSE / mag
  }

  currentBall.vel.x = ix
  currentBall.vel.y = iy
  balls.push(currentBall)
  spawn()
  aiming = false
})

// ================= UTIL =================
function randLevel() {
  return Math.floor(Math.random() * 3)
}

// ================= START =================
spawn()
loop()
