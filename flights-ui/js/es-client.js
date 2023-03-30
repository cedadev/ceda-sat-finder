'use strict'

const { Client } = require('@elastic/elasticsearch')
const client = new Client({
  cloud: { id: '<cloud-id>' },
  auth: { apiKey: 'b0cc021feec53216cb470b36bec8786b10da4aa02d60edb91ade5aae43c07ee6' }
})

async function runElasticRequest (idx) {

  // Let's search!
  const result= await client.search({
    index: idx,
    query: {
      match: { collection : 'arsf' }
    }
  })

  console.log(result.hits.hits)
}