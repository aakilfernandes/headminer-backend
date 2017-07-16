const twitter = require('../lib/twitter')
const connection = require('../lib/connection')
const fs = require('../lib/fs')
const _ = require('lodash')

const workDirPath = `${__dirname}/../workspace/twitterStatuses/`
console.log('start stream')

connection.query('SELECT * FROM publisher_hostnames WHERE publisher_id IS NOT NULL LIMIT 10').then((hostnamePojos) => {
  const keywords = hostnamePojos.map((hostnamePojo) => {
    return hostnamePojo.hostname.split('.')
  })

  console.log(keywords)

  const stream = twitter.stream('statuses/filter', {
    filter_level: 'none',
    track: keywords.join(','),
    locations: [-169.90,52.72,-130.53,72.40,-160.6,18.7,-154.5,22.3,-124.90,23.92,-66.37,50.08].join(',')
  })
  stream.on('data', function(twitter_status) {
    console.log(twitter_status)
    if (!twitter_status) {
      return
    }
    const is_status_valid = _.conforms(twitter_status, {
      contributors: _.isObject,
      id_str: _.isString,
      text: _.isString
    })
    const is_user_valid = twitter_status.user && _.conforms(twitter_status.user, {
      id_str: _.isString
    })
    if (!twitter_status.user) {
      console.log(twitter_status)
    }
    if (!is_status_valid || !is_user_valid) {
      return
    }
    const id = twitter_status.id_str
    console.log(id)
    fs.writeFileAsync(`${workDirPath}${id}.json`, JSON.stringify(twitter_status, null, 2)).then(() => {
      connection.query('INSERT INTO twitter_statuses(id, created_at, user_id) VALUES(?, ?, ?)', [
        id,
        new Date(twitter_status.created_at),
        twitter_status.user.id_str
      ])
    })
  });

  stream.on('error', function(error) {
    throw error;
  });

})
