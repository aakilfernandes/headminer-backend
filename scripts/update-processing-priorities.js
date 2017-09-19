const mysqlQuery = require('../lib/mysqlQuery')
const mysqlDisconnect = require('../lib/mysqlDisconnect')
const fs = require('../lib/fs')

const period_query = 'created_at > NOW() - INTERVAL 48 HOUR'
const period_seconds = 60 * 60 * 48

mysqlQuery(`
  SELECT count(id) as count FROM urls WHERE twitter_statuses_added_at IS NULL AND ${period_query};
  SELECT count(id) as count FROM urls WHERE twitter_statuses_added_at IS NOT NULL AND ${period_query};
  SELECT AVG(TIMESTAMPDIFF(SECOND, twitter_statuses_added_at, NOW())) as average_age
    FROM urls
    WHERE twitter_statuses_added_at IS NOT NULL
      AND ${period_query};

  SELECT count(id) as count FROM urls WHERE facebook_counts_added_at IS NULL AND ${period_query};
  SELECT count(id) as count FROM urls WHERE facebook_counts_added_at IS NOT NULL AND ${period_query};
  SELECT AVG(TIMESTAMPDIFF(SECOND, facebook_counts_added_at, NOW())) as average_age
    FROM urls
    WHERE facebook_counts_added_at IS NOT NULL
      AND ${period_query};

  SELECT count(id) as count FROM articles
    WHERE coallesced_at IS NULL
      AND is_facebook_coallescable = 1
      AND is_twitter_coallescable = 1
      AND ${period_query};
  SELECT count(id) as count FROM articles
    WHERE coallesced_at IS NOT NULL
      AND is_facebook_coallescable = 1
      AND is_twitter_coallescable = 1
      AND ${period_query};
  SELECT AVG(TIMESTAMPDIFF(SECOND, coallesced_at, NOW())) as average_age
    FROM articles
    WHERE coallesced_at IS NOT NULL
      AND is_facebook_coallescable = 1
      AND is_twitter_coallescable = 1
      AND ${period_query};

  SELECT count(urls.id) as count
    FROM urls, domains
    WHERE urls.domain_id = domains.id
      AND domains.is_ignored = 0
      AND scraped_at IS NULL
      AND ${period_query};
  SELECT count(urls.id) as count
    FROM urls, domains
    WHERE urls.domain_id = domains.id
      AND domains.is_ignored = 0
      AND scraped_at IS NOT NULL
      AND ${period_query};
  SELECT AVG(TIMESTAMPDIFF(SECOND, urls.scraped_at, NOW())) as average_age
    FROM urls, domains
    WHERE urls.domain_id = domains.id
      AND domains.is_ignored = 0
      AND scraped_at IS NOT NULL
      AND ${period_query};

  SELECT count(id) as count FROM articles
    WHERE heatified_at IS NULL
      AND coallesced_at IS NOT NULL
      AND ${period_query};
  SELECT count(id) as count FROM articles
    WHERE heatified_at IS NOT NULL
      AND coallesced_at IS NOT NULL
      AND ${period_query};
  SELECT AVG(TIMESTAMPDIFF(SECOND, heatified_at, NOW())) as average_age
    FROM articles
    WHERE heatified_at IS NOT NULL
      AND coallesced_at IS NOT NULL
      AND ${period_query};

  SELECT count(id) as count FROM urls
    WHERE twitter_influencified_at IS NULL
      AND twitter_statuses_count > 100
      AND ${period_query};
  SELECT count(id) as count FROM urls
    WHERE twitter_influencified_at IS NOT NULL
      AND twitter_statuses_count > 100
      AND ${period_query};
  SELECT AVG(TIMESTAMPDIFF(SECOND, twitter_influencified_at, NOW())) as average_age
    FROM urls
    WHERE twitter_influencified_at IS NOT NULL
      AND twitter_statuses_count > 100
      AND ${period_query};

  SELECT count(id) as count FROM articles
    WHERE twitter_influencified_at IS NULL
      AND is_twitter_coallescable = 1
      AND twitter_statuses_count > 100
      AND ${period_query};
  SELECT count(id) as count FROM articles
    WHERE twitter_influencified_at IS NOT NULL
      AND is_twitter_coallescable = 1
      AND twitter_statuses_count > 100
      AND ${period_query};
  SELECT AVG(TIMESTAMPDIFF(SECOND, twitter_influencified_at, NOW())) as average_age
    FROM articles
    WHERE twitter_influencified_at IS NOT NULL
      AND is_twitter_coallescable = 1
      AND twitter_statuses_count > 100
      AND ${period_query};

  SELECT count(id) as count
    FROM twitter_users
    WHERE friends_added_at IS NULL
      AND friends_count <= 200
      AND ${period_query};
  SELECT count(id) as count
    FROM twitter_users
    WHERE friends_added_at IS NOT NULL
      AND friends_count <= 200
      AND ${period_query};
  SELECT AVG(TIMESTAMPDIFF(SECOND, friends_added_at, NOW())) as average_age
    FROM twitter_users
    WHERE friends_added_at IS NOT NULL
      AND friends_count <= 200
      AND ${period_query};
`).then((results) => {
  const processing_priorities = {
    'add-twitter-statuses': getAverageAge(
      results[0][0].count,
      results[1][0].count,
      results[2][0].average_age
    ),
    'add-facebook-counts': getAverageAge(
      results[3][0].count,
      results[4][0].count,
      results[5][0].average_age
    ),
    'coallesce-article': getAverageAge(
      results[6][0].count,
      results[7][0].count,
      results[8][0].average_age
    ),
    'scrape-url': getAverageAge(
      results[9][0].count,
      results[10][0].count,
      results[11][0].average_age
    ),
    'heatify-articles': getAverageAge(
      results[12][0].count,
      results[13][0].count,
      results[14][0].average_age
    ),
    'twitter-influencify-urls': getAverageAge(
      results[15][0].count,
      results[16][0].count,
      results[17][0].average_age
    ),
    'twitter-influencify-articles': getAverageAge(
      results[18][0].count,
      results[19][0].count,
      results[20][0].average_age
    ),
    'add-twitter-friends': getAverageAge(
      results[21][0].count,
      results[22][0].count,
      results[23][0].average_age
    )
  }
  return fs.writeFileAsync(
    `${__dirname}/../workspace/processing_priorities.json`,
    JSON.stringify(processing_priorities, null, 2)
  )
}).finally(() => {
  return mysqlDisconnect()
})

function getAverageAge(null_count, not_null_count, not_null_average) {
  return Math.round(1000 * (
    (null_count * period_seconds) + (not_null_count * not_null_average)
  ) / (null_count + not_null_count))
}
