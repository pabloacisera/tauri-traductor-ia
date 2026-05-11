const API_BASE = 'http://localhost:8000';
let eventSource = null;

export function connectUsageSSE(deviceSeed, callbacks = {}) {
  if (eventSource) {
    eventSource.close();
  }

  const url = `${API_BASE}/events/usage?device_seed=${encodeURIComponent(deviceSeed)}`;
  eventSource = new EventSource(url);

  eventSource.onopen = () => {
    if (callbacks.onConnected) callbacks.onConnected();
  };

  eventSource.onerror = () => {
    setTimeout(() => {
      if (eventSource && eventSource.readyState === EventSource.CLOSED) {
        connectUsageSSE(deviceSeed, callbacks);
      }
    }, 3000);
    if (callbacks.onError) callbacks.onError();
  };

  eventSource.addEventListener('usage_update', (event) => {
    const data = JSON.parse(event.data);
    if (callbacks.onUsageUpdate) callbacks.onUsageUpdate(data);
  });

  eventSource.addEventListener('limit_warning', (event) => {
    const data = JSON.parse(event.data);
    if (callbacks.onLimitWarning) callbacks.onLimitWarning(data);
  });

  eventSource.addEventListener('limit_reached', (event) => {
    const data = JSON.parse(event.data);
    if (callbacks.onLimitReached) callbacks.onLimitReached(data);
  });

  return eventSource;
}

export function disconnectUsageSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}