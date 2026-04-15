import fetch from 'node-fetch';
import User from '../../../Models/USER-Auth/User-Auth.-Model.js';

/**
 * UNIVERSAL PUSH NOTIFICATION SENDER
 * Supports: Web, iOS, Android
 * Style: WhatsApp/Instagram Popup (High Priority)
 */
export const sendPushNotification = async (targetUserId, title, body, data = {}) => {
  try {
    // 1. Get the specific device token for this user
    const user = await User.findById(targetUserId).select('expoPushToken').lean();
    
    if (!user?.expoPushToken) {
      console.log(`⚠️ No Push Token found for user: ${targetUserId}`);
      return; 
    }

    // 2. Construct the Message
    // This structure ensures it pops up on ALL platforms
    const message = {
      to: user.expoPushToken,
      
      // --- VISUALS (What user sees) ---
      sound: 'default',       // Plays sound on mobile
      title: title,           // Bold text (e.g., "New Message")
      body: body,             // Sub-text (e.g., "Hey, check this out...")
      
      // --- DATA (Hidden, used when user taps) ---
      data: data, 
      
      // --- ANDROID CONFIG (Crucial for Popups) ---
      android: {
        channelId: 'default',   // Must match app.json config
        priority: 'high',       // Forces immediate delivery
        importance: 'max',      // Makes it "Heads Up" (Popup)
        vibrationPattern: [0, 250, 250, 250], // Vibration pattern
        lightColor: '#FF231F7C',              // LED color
      },
      
      // --- IOS CONFIG ---
      _displayInForeground: true, // Show popup even if app is open
    };

    // 3. Send to Expo
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 
        Accept: 'application/json', 
        'Accept-encoding': 'gzip, deflate', 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (result.errors) {
      console.error('❌ Push Error:', result.errors);
      // Optional: If token is invalid, delete it from DB here?
    } else {
      console.log(`🔔 Push Sent -> ${title} (User: ${targetUserId})`);
    }

  } catch (error) {
    console.error('❌ sendPushNotification System Error:', error.message);
  }
};