<script lang="ts">
  function handleLogin() {
    // Redirect to the backend OAuth endpoint for Twitch
    window.location.href = 'http://localhost:4000/auth/twitch';
  }
</script>

<button class="login-btn" onclick={handleLogin}>
  <span class="login-icon">🎮</span>
  Login with Twitch
</button>

<style>
  .login-btn {
    background: linear-gradient(135deg, #9146ff 0%, #772ce8 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
  }

  .login-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(145, 70, 255, 0.4);
  }

  .login-btn:active {
    transform: translateY(0);
  }

  .login-icon {
    font-size: 1.2rem;
  }
</style> 