import { API_URL } from '../config';
import { useLiveView } from '../context/useLiveView';
import { ago, dateTimeOf, timeOf } from '../utils/format';

function Row({ label, children }) {
  return <div className="row"><dt>{label}</dt><dd>{children}</dd></div>;
}

const reported = (v) => (v === true ? 'On' : v === false ? 'Off' : 'Not reported by the device');

export default function Device() {
  const { view, live } = useLiveView();
  const s = view.state;
  const online = view.conn === 'online';
  const ids = Object.keys(live.devices);

  return (
    <>
      <div className="head"><h1>Device</h1></div>

      {live.serverDown && <p className="err">The dashboard can't reach the backend, so nothing below is current.</p>}
      {view.conn === 'offline' && <p className="err">Device disconnected. Waiting for sensor data.</p>}
      {view.conn === 'never' && live.booted && <p className="empty">No chair has reported to the backend yet. Power on the ESP32 and check its Wi-Fi and MQTT settings.</p>}

      <section className="block">
        <h2>Connection</h2>
        <dl className="rows">
          <Row label="Device ID">{live.activeId || '--'}</Row>
          <Row label="Status"><span className={online ? 'good' : 'warn'}>{online ? 'Connected' : view.conn === 'offline' ? 'Disconnected' : 'Never seen'}</span></Row>
          <Row label="Last message">
            {view.rxAt ? `${timeOf(view.rxAt)}, ${ago(view.ageMs)}` : '--'}
            {s && s.lastMessageAt && <span className="muted small"> Device timestamp {dateTimeOf(s.lastMessageAt)}</span>}
          </Row>
          <Row label="MQTT broker">{s ? (s.mqttConnected ? 'Connected to the backend' : 'Disconnected from the backend') : '--'}</Row>
          <Row label="Dashboard link">{live.socketUp ? 'Connected' : 'Disconnected'} <span className="muted small">{API_URL}</span></Row>
        </dl>
      </section>

      <section className="block">
        <h2>Sensor health</h2>
        <dl className="rows">
          <Row label="Seat sensor (FSR)">{online ? 'Reporting' : 'Unknown'}</Row>
          <Row label="Distance sensor">
            {online ? (s.distanceCm != null ? `Reporting (${s.distanceCm.toFixed(1)} cm)` : 'No echo. Check the wiring or that something is in range.') : 'Unknown'}
          </Row>
          <Row label="LED">{online ? reported(s.reportedLedOn) : '--'}</Row>
          <Row label="Buzzer">{online ? reported(s.reportedBuzzerOn) : '--'}</Row>
        </dl>
        <p className="muted small">Sensors are only judged while the device is sending data. Values are never shown as live once messages stop.</p>
      </section>

      {ids.length > 1 && (
        <section className="block">
          <h2>All devices</h2>
          <ul className="plain">
            {ids.map((id) => (
              <li key={id}>
                <span>{id}</span>
                {id === live.activeId
                  ? <span className="good">Showing</span>
                  : <button className="linkbtn" onClick={() => live.setActive(id)}>Show this device</button>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
