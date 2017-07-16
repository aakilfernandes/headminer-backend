const request = require('request-promise')
const getRedditPosts = require('../lib/getRedditPosts')
const _ = require('lodash')

module.exports = function getRedditPosts(before, _after) {
  const after = _after ? _.last(_after.split('_')) : '0'
  const url = `https://www.reddit.com/r/all/new.json?limit=100&after=t3_${after}`
  const posts = []

  return request(url, {
    timeout: 5000
  }).then((results_json) => {

    const results = JSON.parse(results_json)
    const _posts = _.map(results.data.children, 'data')

    const index_of_before = _.findIndex(_posts, {
      id: before
    })

    if(index_of_before >= 0) {
      posts.push(..._posts.slice(0, index_of_before))
      return posts
    }

    posts.push(..._posts)

    if (results.data.after) {
      return getRedditPosts(before, results.data.after).then((_posts) => {
        posts.push(..._posts)
        return posts
      })
    }

    return posts

  })

}
