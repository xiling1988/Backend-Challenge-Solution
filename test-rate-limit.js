const BASE_URL = 'http://localhost:3000'
const ENDPOINT = '/orders'
const TTL_MS = 60000 // 60 seconds
const LIMIT = 10 // Match ThrottlerModule limit

// UUIDs from newest Postman data
const MOCK_CUSTOMER_ID = '2da53448-ec09-44e8-a862-912f95fbca68' // John Doe
const MOCK_PRODUCT_IDS = [
  '0d759aa0-e5f0-420d-913d-1b8f0a917e5d', // Running Shoes (stock: 200)
  '59b22626-82b2-4b03-b242-36f86e29ab46', // Water Bottle (stock: 150)
]
const LOCATION_IDS = [
  '9be9cf89-6fe0-457f-936f-e7c1f656481e', // Downtown Store (newest)
  '5070d0d3-f032-45ea-9405-b750fe12fa15', // Mall Location (newest)
]

function buildPayload(locationId) {
  return {
    customerId: MOCK_CUSTOMER_ID,
    locationId,
    items: [
      { productId: MOCK_PRODUCT_IDS[0], quantity: 2 }, // Running Shoes
      { productId: MOCK_PRODUCT_IDS[1], quantity: 1 }, // Water Bottle
    ],
    notes: 'Rate-limit test order',
  }
}

// Helper: Send a single POST request
async function sendRequest(payload, index) {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE_URL}${ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const ok = res.ok
    const status = res.status
    const text = await res.text()
    console.log(
      `Req ${index + 1} (location:${payload.locationId}) @ ${Date.now() - start}ms → ${status} ${ok ? 'OK' : 'ERROR'}`
    )
    if (!ok) console.log('   Response body:', text)
    return { status, ok }
  } catch (err) {
    console.error(`Req ${index + 1} failed:`, err.message)
    return { status: 0, ok: false }
  }
}

// Helper: Wait for TTL
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Test 1: Single location, exceed limit
async function testSingleLocation() {
  console.log('\n=== Test 1: Same location, exceed limit ===')
  const locationId = LOCATION_IDS[0]
  const payload = buildPayload(locationId)

  const results = []
  for (let i = 0; i < LIMIT + 1; i++) {
    const { status, ok } = await sendRequest(payload, i)
    results.push({ index: i + 1, status, ok })
  }

  let passed = true
  for (let i = 0; i < LIMIT; i++) {
    if (results[i].status !== 201) {
      console.error(
        `Request ${i + 1} FAILED – expected 201, got ${results[i].status}`
      )
      passed = false
    }
  }
  if (results[LIMIT].status !== 429) {
    console.error(
      `Request ${LIMIT + 1} FAILED – expected 429, got ${results[LIMIT].status}`
    )
    passed = false
  }

  console.log(`\nWaiting ${TTL_MS / 1000}s for TTL reset...`)
  await wait(TTL_MS)
  const { status: afterStatus } = await sendRequest(payload, LIMIT + 1)
  if (afterStatus !== 201) {
    console.error(`Post-TTL request FAILED – expected 201, got ${afterStatus}`)
    passed = false
  }

  console.log(passed ? 'Test 1 PASSED' : 'Test 1 FAILED')
  return passed
}

// Test 2: Different locations have independent limits
async function testDifferentLocations() {
  console.log('\n=== Test 2: Different locations (independent limits) ===')
  const locA = LOCATION_IDS[0]
  const locB = LOCATION_IDS[1]

  const payloadA = buildPayload(locA)
  const resultsA = []
  for (let i = 0; i < LIMIT + 1; i++) {
    const { status, ok } = await sendRequest(payloadA, i)
    resultsA.push({ index: i + 1, status, ok })
  }

  let passed = true
  for (let i = 0; i < LIMIT; i++) {
    if (resultsA[i].status !== 201) {
      console.error(
        `locA request ${i + 1} FAILED – expected 201, got ${resultsA[i].status}`
      )
      passed = false
    }
  }
  if (resultsA[LIMIT].status !== 429) {
    console.error(
      `locA request ${LIMIT + 1} FAILED – expected 429, got ${resultsA[LIMIT].status}`
    )
    passed = false
  }

  // Wait for TTL to reset locA's counter
  console.log(`\nWaiting ${TTL_MS / 1000}s for locA TTL reset...`)
  await wait(TTL_MS)

  // Test locB independently
  const payloadB = buildPayload(locB)
  const resultsB = []
  for (let i = 0; i < LIMIT + 1; i++) {
    const { status, ok } = await sendRequest(payloadB, i)
    resultsB.push({ index: i + 1, status, ok })
  }

  for (let i = 0; i < LIMIT; i++) {
    if (resultsB[i].status !== 201) {
      console.error(
        `locB request ${i + 1} FAILED – expected 201, got ${resultsB[i].status}`
      )
      passed = false
    }
  }
  if (resultsB[LIMIT].status !== 429) {
    console.error(
      `locB request ${LIMIT + 1} FAILED – expected 429, got ${resultsB[LIMIT].status}`
    )
    passed = false
  }

  console.log(passed ? 'Test 2 PASSED' : 'Test 2 FAILED')
  return passed
}

// Run both tests
;(async () => {
  const passed1 = await testSingleLocation()
  await wait(TTL_MS) // Ensure Test 2 starts with a fresh counter
  const passed2 = await testDifferentLocations()

  if (passed1 && passed2) {
    console.log('\nAll rate-limit tests PASSED')
    process.exit(0)
  } else {
    console.error('\nOne or more rate-limit tests FAILED')
    process.exit(1)
  }
})()
