/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, cookies }) {
  try {
    // Get the session cookie from the browser
    const sessionCookie = cookies.get('_place_server_key');
    
    // Check authentication status with the new endpoint
    const response = await fetch('http://localhost:4000/auth/status', {
      method: 'GET',
      credentials: 'include', // Include cookies for session authentication
      headers: {
        'Content-Type': 'application/json',
        // Forward the session cookie explicitly
        ...(sessionCookie && { 'Cookie': `_place_server_key=${sessionCookie}` }),
      },
    });

    if (response.ok) {
      const authData = await response.json();
      return {
        isAuthenticated: authData.authenticated || false,
        userId: authData.user_id || null,
        userInfo: authData.user_info || null,
      };
    } else {
      // If auth check fails, assume not authenticated
      return {
        isAuthenticated: false,
        userId: null,
        userInfo: null,
      };
    }
  } catch (error) {
    // If there's an error (e.g., network issues), assume not authenticated
    console.error('Auth status check failed:', error);
    return {
      isAuthenticated: false,
      userId: null,
      userInfo: null,
    };
  }
} 