/**
 * ARCADE - Centralized Database API Client
 * Connects frontend to the MongoDB Express backend with automatic offline fallback.
 */

class DatabaseApiClient {
  constructor() {
    this.baseUrl = window.location.origin;
    this.isDbConnected = false;
    this.isServerReachable = false;
    this.eventSource = null;
    this.listeners = new Set();
    this.checkHealth();
  }

  /**
   * Check connection to backend & MongoDB
   */
  async checkHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.baseUrl}/api/status`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        this.isServerReachable = true;
        this.isDbConnected = Boolean(data.dbConnected);
        return { reachable: true, dbConnected: this.isDbConnected };
      }
    } catch (_) {}
    this.isServerReachable = false;
    this.isDbConnected = false;
    return { reachable: false, dbConnected: false };
  }

  /**
   * Subscribe to real-time live events (SSE)
   */
  initLiveSync(onUpdate) {
    if (typeof EventSource === 'undefined') return;
    if (this.eventSource) {
      if (onUpdate) this.listeners.add(onUpdate);
      return;
    }

    try {
      this.eventSource = new EventSource(`${this.baseUrl}/api/events`);
      
      this.eventSource.addEventListener('teams_updated', (e) => {
        try {
          const payload = JSON.parse(e.data);
          this.listeners.forEach(fn => fn('teams_updated', payload));
        } catch (_) {}
      });

      this.eventSource.addEventListener('leaderboard_updated', (e) => {
        try {
          const payload = JSON.parse(e.data);
          this.listeners.forEach(fn => fn('leaderboard_updated', payload));
        } catch (_) {}
      });

      this.eventSource.onerror = () => {
        // SSE reconnects automatically
      };

      if (onUpdate) this.listeners.add(onUpdate);
    } catch (e) {
      console.warn("Live sync SSE could not be initialized:", e);
    }
  }

  // ==========================================
  // AUTHENTICATION
  // ==========================================
  async adminLogin(passphrase) {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase })
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  async participantLogin(teamName, accessCode) {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/participant-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, accessCode })
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  // ==========================================
  // TEAMS / ROSTER
  // ==========================================
  async getTeams() {
    try {
      const res = await fetch(`${this.baseUrl}/api/teams`);
      if (!res.ok) throw new Error("Server error");
      return await res.json();
    } catch (err) {
      return null; // Signals to use local storage fallback
    }
  }

  async createTeam(teamData) {
    try {
      const res = await fetch(`${this.baseUrl}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData)
      });
      if (!res.ok) throw new Error("Could not create team on server");
      return await res.json();
    } catch (err) {
      return null;
    }
  }

  async updateTeam(teamId, data) {
    try {
      const res = await fetch(`${this.baseUrl}/api/teams/${encodeURIComponent(teamId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Could not update team on server");
      return await res.json();
    } catch (err) {
      return null;
    }
  }

  async deleteTeam(teamId) {
    try {
      const res = await fetch(`${this.baseUrl}/api/teams/${encodeURIComponent(teamId)}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  async clearTeams() {
    try {
      const res = await fetch(`${this.baseUrl}/api/teams`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  // ==========================================
  // LEADERBOARD
  // ==========================================
  async getLeaderboard() {
    try {
      const res = await fetch(`${this.baseUrl}/api/leaderboard`);
      if (!res.ok) throw new Error("Server error");
      return await res.json();
    } catch (err) {
      return null; // Fallback to local
    }
  }

  async addLeaderboardEntry(entryData) {
    try {
      const res = await fetch(`${this.baseUrl}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryData)
      });
      if (!res.ok) throw new Error("Could not post leaderboard entry");
      return await res.json();
    } catch (err) {
      return null;
    }
  }

  async resetLeaderboard() {
    try {
      const res = await fetch(`${this.baseUrl}/api/leaderboard/reset`, {
        method: 'POST'
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  // ==========================================
  // PROGRESS
  // ==========================================
  async saveProgress(teamId, data) {
    if (!teamId) return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/progress/${encodeURIComponent(teamId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  async getProgress(teamId) {
    if (!teamId) return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/progress/${encodeURIComponent(teamId)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      return null;
    }
  }
}

export const dbApi = new DatabaseApiClient();
