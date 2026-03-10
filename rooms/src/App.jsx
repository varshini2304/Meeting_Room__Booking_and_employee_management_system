import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const STORAGE_KEY = "roomDisplay:selectedRoom";

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return response.json();
};

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
};

const formatDateTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

function App() {
  const [view, setView] = useState("select");
  const [rooms, setRooms] = useState([]);
  const [roomsError, setRoomsError] = useState("");
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [displayLoading, setDisplayLoading] = useState(false);
  const [displayError, setDisplayError] = useState("");
  const [displayData, setDisplayData] = useState(null);

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
  }, [rooms]);

  const loadRooms = async () => {
    try {
      setRoomsLoading(true);
      setRoomsError("");
      const data = await fetchJson(`${API_BASE}/rooms/public`);
      setRooms(data || []);
      if (!selectedRoom && data?.length) {
        setSelectedRoom(data[0].roomNumber);
      }
    } catch (error) {
      setRoomsError(error instanceof Error ? error.message : "Failed to load rooms");
    } finally {
      setRoomsLoading(false);
    }
  };

  const loadRoomDisplay = async (roomNumber) => {
    if (!roomNumber) return;
    try {
      setDisplayLoading(true);
      setDisplayError("");
      const data = await fetchJson(
        `${API_BASE}/rooms/active-booking?roomNumber=${encodeURIComponent(roomNumber)}`
      );
      setDisplayData(data);
    } catch (error) {
      setDisplayError(error instanceof Error ? error.message : "Failed to load room display");
    } finally {
      setDisplayLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSelectedRoom(stored);
      setView("display");
    }
  }, []);

  useEffect(() => {
    if (view !== "display" || !selectedRoom) return;
    loadRoomDisplay(selectedRoom);
    const timer = setInterval(() => loadRoomDisplay(selectedRoom), 30000);
    return () => clearInterval(timer);
  }, [view, selectedRoom]);

  const handleSelect = () => {
    if (!selectedRoom) return;
    localStorage.setItem(STORAGE_KEY, selectedRoom);
    setView("display");
  };

  const handleBack = () => {
    setView("select");
  };

  const statusLabel = displayData?.booking ? "Booked" : "Available";

  return (
    <div className="app-shell">
      <div className="bg-veil" />
      <main className="page">
        <header className="hero">
          <div className="logo">TOYOTA</div>
          <h1>Toyota Meeting Room Display</h1>
          <p>Select the room this display belongs to.</p>
        </header>

        {view === "select" ? (
          <section className="card">
            <div className="field">
              <label>Room Number</label>
              <div className="select-wrap">
                <select
                  value={selectedRoom}
                  onChange={(event) => setSelectedRoom(event.target.value)}
                  disabled={roomsLoading || !rooms.length}
                >
                  {sortedRooms.map((room) => (
                    <option key={room.roomNumber} value={room.roomNumber}>
                      {room.roomNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="room-list">
              {roomsLoading && <div className="muted">Loading rooms...</div>}
              {!roomsLoading && roomsError && <div className="error">{roomsError}</div>}
              {!roomsLoading && !roomsError && sortedRooms.length === 0 && (
                <div className="muted">No rooms found.</div>
              )}
              {sortedRooms.map((room) => (
                <button
                  key={room.roomNumber}
                  type="button"
                  className={`room-item ${selectedRoom === room.roomNumber ? "active" : ""}`}
                  onClick={() => setSelectedRoom(room.roomNumber)}
                >
                  <span className="room-pill">{room.roomType?.includes("Meeting") ? "MR" : "CR"}</span>
                  <span>{room.roomNumber}</span>
                  <span className="room-meta">{room.branch}</span>
                </button>
              ))}
            </div>

            <button className="primary" onClick={handleSelect} disabled={!selectedRoom}>
              Select Room
            </button>

            <div className="toggle-row">
              <input id="auto-detect" type="checkbox" />
              <label htmlFor="auto-detect">Auto-detect room based on device location</label>
            </div>

            <div className="actions">
              <button className="ghost" onClick={handleSelect} disabled={!selectedRoom}>
                Load Room Display
              </button>
              <button className="ghost" onClick={loadRooms}>
                Refresh Room List
              </button>
            </div>
          </section>
        ) : (
          <section className="card display">
            <div className="display-header">
              <div>
                <h2>Room Display</h2>
                <p className="muted">Live status updates every 30 seconds.</p>
              </div>
              <div className={`status ${displayData?.booking ? "booked" : "available"}`}>
                {statusLabel}
              </div>
            </div>

            {displayLoading && <div className="muted">Loading room data...</div>}
            {displayError && <div className="error">{displayError}</div>}

            {!displayLoading && !displayError && displayData && (
              <>
                <div className="grid">
                  <div className="panel">
                    <h3>Room Details</h3>
                    <p><span>Room:</span> {displayData.room?.roomNumber}</p>
                    <p><span>Type:</span> {displayData.room?.roomType}</p>
                    <p><span>Capacity:</span> {displayData.room?.capacity}</p>
                    <p><span>Location:</span> {displayData.room?.country}, {displayData.room?.branch}, {displayData.room?.block}, {displayData.room?.floor}</p>
                  </div>
                  <div className="panel">
                    <h3>Booking Details</h3>
                    {displayData.booking ? (
                      <>
                        <p><span>Organizer:</span> {displayData.booking.owner?.name}</p>
                        <p><span>Email:</span> {displayData.booking.owner?.email}</p>
                        <p><span>Date:</span> {formatDate(displayData.booking.date)}</p>
                        <p><span>Time:</span> {displayData.booking.startTime} - {displayData.booking.endTime}</p>
                      </>
                    ) : (
                      <p className="muted">No active booking for this room.</p>
                    )}
                  </div>
                </div>

                <div className="secret">
                  <div>
                    <h3>Room Secret Code</h3>
                    <p className="muted">Share this code with the organizer for check-in.</p>
                  </div>
                  <div className="code">{displayData.secretCode || "-"}</div>
                </div>

                <div className="actions">
                  <button className="ghost" onClick={() => loadRoomDisplay(selectedRoom)}>
                    Refresh
                  </button>
                  <button className="ghost" onClick={handleBack}>
                    Change Room
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        <footer className="footer">TOYOTA</footer>
      </main>
    </div>
  );
}

export default App;
