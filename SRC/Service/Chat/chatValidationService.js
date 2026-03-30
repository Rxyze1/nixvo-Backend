// Services/Chat/chatValidationService.js

import User from '../../Models/USER-Auth/User-Auth.-Model.js';

/**
 * ═══════════════════════════════════════════════════════════════
 *                  🔐 CHAT VALIDATION SERVICE
 *         Validates if users are allowed to chat with each other
 * ═══════════════════════════════════════════════════════════════
 * 
 * RULES:
 * ❌ Employee ↔ Employee = BLOCKED
 * ❌ Client ↔ Client = BLOCKED
 * ✅ Employee ↔ Client = ALLOWED
 * ✅ Officials ↔ Anyone = ALLOWED
 * 
 * ═══════════════════════════════════════════════════════════════
 */

class ChatValidationService {
  
  constructor() {
    console.log('🔐 ChatValidationService initialized');
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ✅ CHECK IF TWO USERS CAN CHAT
  // ═══════════════════════════════════════════════════════════════
  
  async canUsersChat(user1Id, user2Id) {
    try {
      console.log('\n🔍 [Chat Validation] Checking if users can chat...');
      console.log(`User 1: ${user1Id}`);
      console.log(`User 2: ${user2Id}`);
      
      // ─────────────────────────────────────────────────────────
      // STEP 1: Fetch both users
      // ─────────────────────────────────────────────────────────
      
      const [user1, user2] = await Promise.all([
        User.findById(user1Id).select('fullname username userType status isAdminVerified'),
        User.findById(user2Id).select('fullname username userType status isAdminVerified')
      ]);
      
      if (!user1 || !user2) {
        return {
          allowed: false,
          reason: '❌ One or both users not found'
        };
      }
      
      console.log(`👤 User 1: ${user1.fullname} (${user1.userType})`);
      console.log(`👤 User 2: ${user2.fullname} (${user2.userType})`);
      
      // ─────────────────────────────────────────────────────────
      // STEP 2: Check if both users are active
      // ─────────────────────────────────────────────────────────
      
      if (user1.status !== 'active') {
        return {
          allowed: false,
          reason: `❌ ${user1.fullname} is not active`
        };
      }
      
      if (user2.status !== 'active') {
        return {
          allowed: false,
          reason: `❌ ${user2.fullname} is not active`
        };
      }
      
      // ─────────────────────────────────────────────────────────
      // STEP 3: Apply chat rules based on user types
      // ─────────────────────────────────────────────────────────
      
      const userType1 = user1.userType;
      const userType2 = user2.userType;
      
      // ❌ RULE 1: Employee CANNOT chat with Employee
      if (userType1 === 'employee' && userType2 === 'employee') {
        console.log('🚫 BLOCKED: Employee ↔ Employee');
        return {
          allowed: false,
          reason: '❌ Employees cannot chat with other employees'
        };
      }
      
      // ❌ RULE 2: Client CANNOT chat with Client
      if (userType1 === 'client' && userType2 === 'client') {
        console.log('🚫 BLOCKED: Client ↔ Client');
        return {
          allowed: false,
          reason: '❌ Clients cannot chat with other clients'
        };
      }
      
      // ✅ RULE 3: Officials CAN chat with EVERYONE
      if (userType1 === 'officials' || userType2 === 'officials') {
        console.log('✅ ALLOWED: Officials can communicate with all user types');
        return {
          allowed: true,
          reason: '✅ Officials can communicate with all user types'
        };
      }
      
      // ✅ RULE 4: Employee ↔ Client (ALLOWED)
      if (
        (userType1 === 'employee' && userType2 === 'client') ||
        (userType1 === 'client' && userType2 === 'employee')
      ) {
        console.log('✅ ALLOWED: Employee ↔ Client');
        return {
          allowed: true,
          reason: '✅ Employee and Client can communicate'
        };
      }
      
      // ❌ Fallback (shouldn't reach here)
      console.log('🚫 BLOCKED: Invalid user type combination');
      return {
        allowed: false,
        reason: '❌ Invalid user type combination'
      };
      
    } catch (error) {
      console.error('❌ Chat validation error:', error);
      return {
        allowed: false,
        reason: '❌ Validation error occurred',
        error: error.message
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 🔍 SEARCH ALLOWED USERS (for chat search)
  // ═══════════════════════════════════════════════════════════════
  
  async searchAllowedUsers(currentUserId, searchQuery) {
    try {
      console.log('\n🔍 [Search Users] Starting search...');
      console.log(`Current User: ${currentUserId}`);
      console.log(`Search Query: "${searchQuery}"`);
      
      // ─────────────────────────────────────────────────────────
      // STEP 1: Get current user
      // ─────────────────────────────────────────────────────────
      
      const currentUser = await User.findById(currentUserId).select('userType');
      
      if (!currentUser) {
        throw new Error('Current user not found');
      }
      
      console.log(`👤 Current User Type: ${currentUser.userType}`);
      
      // ─────────────────────────────────────────────────────────
      // STEP 2: Build search filter
      // ─────────────────────────────────────────────────────────
      
      const filter = {
        _id: { $ne: currentUserId }, // Exclude self
        status: 'active',
        isAdminVerified: true, // Only show verified users
        $or: [
          { fullname: { $regex: searchQuery, $options: 'i' } },
          { username: { $regex: searchQuery, $options: 'i' } },
          { email: { $regex: searchQuery, $options: 'i' } }
        ]
      };
      
      // ─────────────────────────────────────────────────────────
      // STEP 3: Apply user type restrictions
      // ─────────────────────────────────────────────────────────
      
      // EMPLOYEE: Can only search CLIENTS and OFFICIALS
      if (currentUser.userType === 'employee') {
        filter.userType = { $in: ['client', 'officials'] };
        console.log('🔍 Employee searching: Clients + Officials only');
      }
      
      // CLIENT: Can only search EMPLOYEES and OFFICIALS
      else if (currentUser.userType === 'client') {
        filter.userType = { $in: ['employee', 'officials'] };
        console.log('🔍 Client searching: Employees + Officials only');
      }
      
      // OFFICIALS: Can search EVERYONE
      else if (currentUser.userType === 'officials') {
        console.log('🔍 Officials searching: Everyone');
        // No restriction
      }
      
      // Unknown user type
      else {
        console.log('❌ Unknown user type');
        return [];
      }
      
      // ─────────────────────────────────────────────────────────
      // STEP 4: Execute search
      // ─────────────────────────────────────────────────────────
      
      const users = await User.find(filter)
        .select('fullname username email userType isAdminVerified status createdAt')
        .sort({ fullname: 1 })
        .limit(20);
      
      console.log(`✅ Found ${users.length} users`);
      
      return users;
      
    } catch (error) {
      console.error('❌ Search error:', error);
      throw error;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ✅ BATCH VALIDATION (Check multiple users at once)
  // ═══════════════════════════════════════════════════════════════
  
  async canUsersChatBatch(currentUserId, userIds) {
    try {
      const results = await Promise.all(
        userIds.map(async (userId) => {
          const validation = await this.canUsersChat(currentUserId, userId);
          return {
            userId,
            allowed: validation.allowed,
            reason: validation.reason
          };
        })
      );
      
      return results;
      
    } catch (error) {
      console.error('❌ Batch validation error:', error);
      throw error;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 📊 GET VALIDATION STATS
  // ═══════════════════════════════════════════════════════════════
  
  getStats() {
    return {
      service: 'ChatValidationService',
      version: '1.0.0',
      rules: {
        employeeToEmployee: 'BLOCKED',
        clientToClient: 'BLOCKED',
        employeeToClient: 'ALLOWED',
        officialsToAny: 'ALLOWED'
      }
    };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 🏥 HEALTH CHECK
  // ═══════════════════════════════════════════════════════════════
  
  getHealth() {
    return {
      status: 'healthy',
      service: 'ChatValidationService',
      ready: true
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════

export default new ChatValidationService();