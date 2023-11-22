import ICAL from 'ical.js';
import dayjs from 'dayjs';
//import localforage from 'localforage';
//import { DAVClient, DAVNamespaceShort } from './assets/js/tsdav.js';
//import { accounts } from './app.js';

const channel = new BroadcastChannel('sw-messages');

//parse calendar events and send back to mainscript
const parse_ics = function (
  data,
  isSubscription,
  etag,
  url,
  account_id,
  isCaldav,
  alarm
) {
  let jcalData;
  try {
    jcalData = ICAL.parse(data);
  } catch (e) {}

  var comp = new ICAL.Component(jcalData);

  var vevent = comp.getAllSubcomponents('vevent');
  let calendar_name = comp.getFirstPropertyValue('x-wr-calname') || '';
  let imp;
  vevent.forEach(function (ite) {
    let n = '';
    let rr_until = '';
    let allday = false;
    let date_start = ite.getFirstPropertyValue('dtstart');
    let date_end = ite.getFirstPropertyValue('dtend');
    const rrule = ite.getFirstPropertyValue('rrule');

    if (date_start.isDate && date_end.isDate) allday = true;

    if (rrule && typeof rrule === 'object' && rrule.freq) {
      n = rrule;
      rr_until = n.until || '';
    }
    //date start
    let dateStart, timeStart, dateStartUnix;
    if (date_start) {
      let a = dayjs(date_start);
      dateStart = a.format('YYYY-MM-DD');
      timeStart = a.format('HH:mm:ss');
      dateStartUnix = a.unix();
    }

    //date end
    let dateEnd, timeEnd, dateEndUnix;
    if (date_end) {
      let a = dayjs(date_end);
      dateEnd = a.format('YYYY-MM-DD');
      timeEnd = a.format('HH:mm:ss');
      dateEndUnix = a.unix();

      if (rr_until != '') {
        dateEnd = dayjs(n.until).format('YYYY-MM-DD');
        timeEnd = dayjs(n.until).format('HH:mm:ss');
        dateEndUnix = new Date(n.until).getTime() / 1000;
      }
      //allDay
      if (allday) {
        let f = ite.getFirstPropertyValue('dtend').toJSDate();
        f = new Date(dayjs(f).subtract(1, 'day'));
        dateEnd = dayjs(f).format('YYYY-MM-DD');
        timeEnd = dayjs(f).format('HH:mm:ss');
        dateEndUnix = f.getTime() / 1000;
      }
    }

    imp = {
      BEGIN: 'VEVENT',
      UID: ite.getFirstPropertyValue('uid'),
      SUMMARY: ite.getFirstPropertyValue('summary'),
      LOCATION: ite.getFirstPropertyValue('location'),
      DESCRIPTION: ite.getFirstPropertyValue('description'),
      CATEGORIES: ite.getFirstPropertyValue('categories') || '',
      RRULE: ite.getFirstPropertyValue('rrule') || '',
      'LAST-MODIFIED': ite.getFirstPropertyValue('last-modified'),
      CLASS: ite.getFirstPropertyValue('class') || '',
      DTSTAMP: ite.getFirstPropertyValue('dtstart'),
      DTSTART: ite.getFirstPropertyValue('dtstart'),
      DTEND: ite.getFirstPropertyValue('dtend'),
      END: 'VEVENT',
      isSubscription: isSubscription,
      isCaldav: isCaldav,
      allDay: allday,
      dateStart: dateStart,
      dateStartUnix: dateStartUnix,
      dateEndUnix: dateEndUnix,
      dateEnd: dateEnd,
      time_start: timeStart,
      time_end: timeEnd,
      alarm: alarm || 'none',
      etag: etag,
      url: url,
      calendar_name: calendar_name,
      id: account_id,
    };
  });
  return imp;
};

self.addEventListener('message', (event) => {
  // Receive a message from the main thread
  if (!event.data) {
    channel.postMessage({ action: 'error', content: 'error' });
    return false;
  }
  let ff = parse_ics(
    event.data.t.data,
    false,
    event.data.t.etag,
    event.data.t.url,
    event.data.e,
    true,
    false
  );

  // Post the result back to the main thread
  channel.postMessage({ action: 'parse', content: ff });
});

/*
//loggin
//login handler
const clientInstances = {};
const isLoggedInMap = {};

async function getClientInstance(item) {
  try {
    if (!clientInstances[item.id]) {
      if (item.type === 'oauth') {
        clientInstances[item.id] = new DAVClient({
          serverUrl: item.server_url,
          credentials: {
            tokenUrl: google_acc.token_url,
            refreshToken: item.tokens.refresh_token,
            clientId: google_cred.clientId,
            clientSecret: google_cred.clientSecret,
            authorizationCode: item.authorizationCode,
            redirectUrl: google_acc.redirect_url,
          },
          authMethod: 'Oauth',
          defaultAccountType: 'caldav',
        });
      } else {
        clientInstances[item.id] = new DAVClient({
          serverUrl: item.server_url,
          credentials: {
            username: item.user,
            password: item.password,
          },
          authMethod: 'Basic',
          defaultAccountType: 'caldav',
        });
      }
    }
    return clientInstances[item.id];
  } catch (e) {
    channel.postMessage({ action: 'error', content: e });
  }
}

*/

//System messages

self.onsystemmessage = (evt) => {
  try {
    const serviceHandler = async () => {
      if (evt.name === 'activity') {
        handler = evt.data.webActivityRequestHandler();
        const { name: activityName, data: activityData } = handler.source;
        if (activityName == 'greg-oauth') {
          let code = activityData.code;

          const url = '/oauth.html?code=' + code;
          channel.postMessage({
            oauth_success: url,
          });
        }
      }

      if (evt.name === 'alarm') {
        let m = evt.data.json();

        if (m.data.note == 'keep alive') {
          // todo sync caldav
          /*
          self.registration.showNotification('Test', {
            body: m.data.note,
          });

          var d = new Date();
          d.setMinutes(d.getMinutes() + 2);

          let options = {
            date: d,
            data: { note: 'keep alive', type: 'background_sync' },
            ignoreTimezone: false,
          };

          navigator.b2g.alarmManager
            .add(options)
            .then(
              channel.postMessage({ action: 'background_sync', content: '' })
            );

            */
        } else {
          self.registration.showNotification('Greg', {
            body: m.data.note,
          });
        }
      }
    };

    evt.waitUntil(serviceHandler());
  } catch (e) {
    channel.postMessage({ action: 'error', content: e });
  }
};
