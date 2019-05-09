const Collections = require('tre-watch-collections')
const h = require('mutant/html-element')
const computed = require('mutant/computed')
const Value = require('mutant/value')
const pull = require('pull-stream')
const many = require('pull-many')
const Calendar = require('tre-calendar')

module.exports = function(ssb, iconByName) {
  const collection = Collections(ssb)
  const renderCalendar = Calendar(ssb)

  return function(opts) {
    opts = opts || {}
    const mutedCalendars = Value([])

    function isMuted(kv) {
      return mutedCalendars().includes(revisionRoot(kv))
    }
   
    const activeCalendars = computed([
      collection(ssb.revisions.messagesByType('calendar', {
        live:true, sync: true, resolvePrototypes: false
      }), kvObs => computed(kvObs, kv=>revisionRoot(kv))),
      mutedCalendars
    ], (ks, mutedKs) => {
      return ks.filter(k => !mutedKs.includes(k))
    })

    const mergedCalendar = computed(activeCalendars, ks =>{
      let ignoreSyncs = activeCalendars.length-1
      const source = pull(
        many(
          ks.map(k => ssb.revisions.messagesByBranch(k, {live: true, sync: true}))
        ),
        pull.filter(x=>{
          if (!x.sync) return true
          if (ignoreSyncs) {
            ignoreSyncs--
            return false
          }
          return true
        })
      )
      const kv = {
        key: 'fake',
        value: {
          content: {
            type: 'calendar',
            name: 'Merged Calendar'
          }
        }
      }
      return renderCalendar(kv, {source, where: 'widget'})
    })

    return h('.tre-calendar-panel', [
      renderSwitches(),
      mergedCalendar
    ])

    function renderSwitches() {
      return collection(ssb.revisions.messagesByType('calendar', {live:true, sync: true}), kvObs =>{
        return computed(kvObs, kv =>{
          if (!kv) return []
          return h('.tre-calendar-switch', {
            classList: computed(mutedCalendars, mutedCalendars =>{
              return isMuted(kv) ? ['muted'] : []
            }),
            'ev-click': ev => {
              if (isMuted(kv)) mutedCalendars.set(mutedCalendars().filter(x=>x!=revisionRoot(kv)))
              else mutedCalendars.set(mutedCalendars().concat([revisionRoot(kv)]))
            }
          }, [
            computed(mutedCalendars, mutedCalendars => {
              return iconByName(isMuted(kv) ? 'eye off' : 'eye')
            }),
            h('.name', kv.value.content.name || 'no name')
          ])
        })
      })

    }
  }
}

// -- utils

function revisionRoot(kv) {
  return kv && (kv.value.content.revisionRoot || kv.key)
}
