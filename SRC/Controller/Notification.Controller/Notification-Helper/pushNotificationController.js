import fetch from 'node-fetch';
import User from '../../../Models/USER-Auth/User-Auth.-Model.js';
import Client from '../../../Models/USER-Auth/Client-Model.js';
import Employee from '../../../Models/USER-Auth/Employee-Model.js';

// ═══════════════════════════════════════════════════════════════
// 🔧 CORE ENGINE: Sends the actual request to Expo
// ═══════════════════════════════════════════════════════════════

const sendToExpo = async (pushToken, title, body, data = {}) => {
  if (!pushToken) return;

  const message = {
    to: pushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data, // Hidden data used when user taps notification
    android: {
      channelId: 'default',
      priority: 'high', 
      importance: 'max' 
    },
  };

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 
        Accept: 'application/json', 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(message),
    });
    console.log(`🚀 [Push Sent] -> ${title}`);
  } catch (error) {
    console.error('❌ [Push Error]', error.message);
  }
};

// ═══════════════════════════════════════════════════════════════
// 🛡️ HELPER: Get User Profile Picture (Checks Client/Employee DB)
// ═══════════════════════════════════════════════════════════════

const getUserProfilePic = async (userId, userType) => {
  try {
    let profilePic = null;
    if (userType === 'client') {
      const client = await Client.findOne({ userId }).select('profilePic').lean();
      profilePic = client?.profilePic;
    } else if (userType === 'employee') {
      const emp = await Employee.findOne({ userId }).select('profilePic').lean();
      profilePic = emp?.profilePic;
    }
    return profilePic;
  } catch (e) {
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════
// 👔 CLIENT NOTIFICATIONS (Notify the Job Poster)
// ═══════════════════════════════════════════════════════════════

export const notifyClient = async (clientUserId, type, extraData = {}) => {
  try {
    const user = await User.findById(clientUserId).select('expoPushToken fullname userType').lean();
    if (!user?.expoPushToken) return;

    let title = '';
    let body = '';
    let screenData = {};

    switch (type) {
      case 'NEW_APPLICATION':
        title = `📬 New Application`;
        body = `${extraData.employeeName || 'Someone'} applied to "${extraData.jobTitle || 'your job'}"`;
        screenData = { screen: 'JobDetails', jobId: extraData.jobId };
        break;

      case 'NEW_MESSAGE':
        title = `💬 ${extraData.senderName || 'Someone'}`;
        body = extraData.messagePreview || 'Sent a message';
        
        // ✅ Attach sender profile data
        screenData = { 

          screen: 'MessageScreen', 
          conversationId: extraData.conversationId,
          senderId: extraData.senderId || null,
          senderName: extraData.senderName || null,
          senderType: extraData.senderType || null,
          senderProfilePic: extraData.senderProfilePic || null,




        };
        break;

      case 'APPLICATION_ACCEPTED':
        title = `✅ Hired!`;
        body = `You accepted ${extraData.employeeName}'s application.`;
        screenData = { screen: 'ChatRoom', conversationId: extraData.conversationId };
        break;
        
      default:
        return;
    }

    await sendToExpo(user.expoPushToken, title, body, screenData);

  } catch (err) {
    console.error('❌ Error in notifyClient:', err.message);
  }
};

// ═══════════════════════════════════════════════════════════════
// 👷 EMPLOYEE NOTIFICATIONS (Notify the Applicant)
// ═══════════════════════════════════════════════════════════════

export const notifyEmployee = async (employeeUserId, type, extraData = {}) => {
  try {
    const user = await User.findById(employeeUserId).select('expoPushToken fullname userType').lean();
    if (!user?.expoPushToken) return;

    let title = '';
    let body = '';
    let screenData = {};

    switch (type) {
      case 'JOB_RECOMMENDED':
        title = `🌟 Recommended for you`;
        body = `Check out "${extraData.jobTitle}" - Great match!`;
        screenData = { screen: 'JobDetails', jobId: extraData.jobId };
        break;

      case 'APPLICATION_STATUS_CHANGE':
        if (extraData.status === 'accepted') {
          title = `🎉 Congratulations!`;
          body = `You got the job "${extraData.jobTitle}"!`;
        } else {
          title = `📋 Application Update`;
          body = `Application for "${extraData.jobTitle}" was ${extraData.status}.`;
        }
        screenData = { screen: 'ApplicationStatus', appId: extraData.applicationId };
        break;

      case 'NEW_MESSAGE':
        title = `💬 ${extraData.senderName || 'Someone'}`;
        body = extraData.messagePreview || 'Sent you a message';
        
        // ✅ Attach sender profile data
        screenData = { 
          screen: 'MessageScreen', 
          conversationId: extraData.conversationId,
          senderId: extraData.senderId || null,
          senderName: extraData.senderName || null,
          senderType: extraData.senderType || null,
          senderProfilePic: extraData.senderProfilePic || null,
        };
        break;

      default:
         return;
    }

    await sendToExpo(user.expoPushToken, title, body, screenData);

  } catch (err) {
    console.error('❌ Error in notifyEmployee:', err.message);
  }
};