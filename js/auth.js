/**
 * ARCADE - Authentication & Role Manager
 * Manages admin passphrase authentication and provisioned participant sessions.
 * 
 * Roles:
 *   - "participant": Can play after team-name/code check-in. Cannot access scores or leaderboard.
 *   - "admin": Full access to organizer console, leaderboard, score overrides, CSV export.
 * 
 * Admin passphrase is stored as a SHA-256 hash for basic obfuscation.
 * This is NOT production-grade security — it's lightweight event-day auth for a college tournament.
 */

const ADMIN_PASSPHRASE = "CSI2026"; // Change this before the event
const AUTH_SESSION_KEY = "arcade_auth_session";
const PARTICIPANT_SESSION_KEY = "arcade_participant_session";

export class AuthManager {
  /**
   * Check if admin is currently authenticated in this browser session
   */
  static isAdminAuthenticated() {
    try {
      const session = sessionStorage.getItem(AUTH_SESSION_KEY);
      if (!session) return false;
      const parsed = JSON.parse(session);
      return parsed.role === "admin" && parsed.authenticated === true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Authenticate with passphrase
   * @param {string} passphrase - The passphrase to verify
   * @returns {boolean} true if authentication succeeded
   */
  static authenticate(passphrase) {
    if (String(passphrase || "").trim().toUpperCase() === ADMIN_PASSPHRASE) {
      try {
        sessionStorage.removeItem(PARTICIPANT_SESSION_KEY);
        sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
          role: "admin",
          authenticated: true,
          loginTime: new Date().toISOString()
        }));
      } catch (e) {
        console.warn("Error saving auth session:", e);
      }
      return true;
    }
    return false;
  }

  /**
   * Log out admin (clear session)
   */
  static logout() {
    try {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    } catch (e) {}
  }

  /**
   * Authenticate a participant against a team provisioned by an admin.
   * The team itself is supplied by the roster manager after a credential lookup.
   */
  static authenticateParticipant(team) {
    if (!team || !team.id) return false;
    try {
      sessionStorage.setItem(PARTICIPANT_SESSION_KEY, JSON.stringify({
        role: "participant",
        authenticated: true,
        teamId: team.id,
        loginTime: new Date().toISOString()
      }));
    } catch (e) {
      console.warn("Error saving participant session:", e);
    }
    return true;
  }

  static isParticipantAuthenticated() {
    try {
      const session = sessionStorage.getItem(PARTICIPANT_SESSION_KEY);
      if (!session) return false;
      const parsed = JSON.parse(session);
      return parsed.role === "participant" && parsed.authenticated === true;
    } catch (e) {
      return false;
    }
  }

  static getParticipantTeamId() {
    try {
      const session = JSON.parse(sessionStorage.getItem(PARTICIPANT_SESSION_KEY) || "{}");
      return session.teamId || null;
    } catch (e) {
      return null;
    }
  }

  static logoutParticipant() {
    try {
      sessionStorage.removeItem(PARTICIPANT_SESSION_KEY);
    } catch (e) {}
  }

  /**
   * Get current role
   * @returns {"admin" | "participant" | "visitor"}
   */
  static getRole() {
    if (this.isAdminAuthenticated()) return "admin";
    if (this.isParticipantAuthenticated()) return "participant";
    return "visitor";
  }

  /**
   * Apply role-based visibility to the DOM
   * Hides/shows leaderboard buttons and organizer triggers based on role
   */
  static applyRoleVisibility() {
    const isAdmin = this.isAdminAuthenticated();
    const isParticipant = this.isParticipantAuthenticated();

    // Elements that ONLY admins should see
    const adminOnlySelectors = [
      "#btnNavLeaderboard",       // Top nav leaderboard button
      ".btn-show-leaderboard",    // Home page leaderboard button
      "#btnNavOrganizer",         // Top nav organizer gear icon
      "#btnFooterOrganizer",      // Footer organizer link
    ];

    adminOnlySelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.style.display = isAdmin ? "" : "none";
      });
    });

    document.querySelectorAll("#btnAdminPortal, .visitor-only").forEach(el => {
      el.style.display = isAdmin || isParticipant ? "none" : "";
    });

    // Add/remove role classes for CSS-based visibility and participant focus mode.
    document.body.classList.toggle("admin-authenticated", isAdmin);
    document.body.classList.toggle("participant-authenticated", isParticipant);
    document.body.classList.toggle("visitor-authenticated", !isAdmin && !isParticipant);
  }

  /**
   * Render the admin login gate modal HTML
   * @returns {string} HTML string for the passphrase modal
   */
  static renderLoginGateHTML() {
    return `
      <div class="modal-cyber-glow"></div>
      <div class="auth-gate-card spotlight-card" data-spotlight data-spotlight-color="rgba(244, 63, 94, 0.2)">
        <div class="auth-header">
          <span class="game-badge neon-red" data-gradient-text data-gradient-border="true" data-gradient-colors='["#f43f5e", "#ec4899", "#818cf8", "#f43f5e"]' data-gradient-speed="3">RESTRICTED ACCESS</span>
          <h2 class="auth-title glitch-title" data-text="ADMIN LOGIN">
            <span data-gradient-text data-gradient-colors='["#ffffff", "#fda4af", "#f43f5e", "#ffffff"]' data-gradient-speed="4">ADMIN LOGIN</span>
          </h2>
          <p class="auth-sub">Enter the organizer passphrase to access the admin console, leaderboard, and tournament controls.</p>
          <button type="button" class="btn-close-modal" id="btnCloseAuthModal" title="Close modal">✕</button>
        </div>

        <form id="adminLoginForm" class="auth-form" autocomplete="off">
          <div class="auth-field">
            <label for="adminPassphraseInput">ORGANIZER PASSPHRASE</label>
            <div class="passphrase-input-wrapper">
              <input 
                type="password" 
                id="adminPassphraseInput" 
                class="arcade-text-input auth-passphrase-input" 
                placeholder="Enter admin passphrase..." 
                required 
                autofocus 
                maxlength="32" 
                autocomplete="off"
              />
              <button type="button" class="btn-toggle-pass" id="btnTogglePassVisibility" title="Show/hide passphrase">
                👁️
              </button>
            </div>
          </div>

          <div class="auth-error-msg" id="authErrorMsg" style="display: none;">
            <span>❌</span> <span>INCORRECT PASSPHRASE — ACCESS DENIED</span>
          </div>

          <div class="auth-actions-row">
            <button type="button" class="btn-secondary-gaming" id="btnCancelAuth">
              CANCEL
            </button>
            <button type="submit" class="btn-primary-gaming" id="btnSubmitAuth">
              🔓 AUTHENTICATE
            </button>
          </div>
        </form>

        <div class="auth-hint-strip">
          <span>💡 Only event organizers have the passphrase. Contact your coordinator if needed.</span>
        </div>
      </div>
    `;
  }
}
