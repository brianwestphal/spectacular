// Todo List — generated from Spectacular spec

import Foundation
import Combine
import Security

class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let tokenKey = "auth_token"
    private let refreshTokenKey = "refresh_token"
    private var tokenRefreshTimer: Timer?
    
    init() {
        checkAuthState()
        startTokenRefreshTimer()
    }
    
    func signIn(email: String, password: String) async {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        
        do {
            // Simulate API call
            try await Task.sleep(nanoseconds: 1_000_000_000)
            
            let user = User(email: email, authProvider: .email)
            let token = "mock_token_\(UUID().uuidString)"
            let refreshToken = "mock_refresh_\(UUID().uuidString)"
            
            try storeToken(token)
            try storeRefreshToken(refreshToken)
            
            await MainActor.run {
                self.currentUser = user
                self.isAuthenticated = true
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = error.localizedDescription
                self.isLoading = false
            }
        }
    }
    
    func signOut() {
        deleteToken()
        deleteRefreshToken()
        tokenRefreshTimer?.invalidate()
        
        currentUser = nil
        isAuthenticated = false
    }
    
    private func checkAuthState() {
        if let token = retrieveToken(), !token.isEmpty {
            // In a real app, validate token with backend
            isAuthenticated = true
            currentUser = User(email: "user@example.com") // Mock user
        }
    }
    
    private func startTokenRefreshTimer() {
        // Refresh token every 23 hours (tokens expire after 24 hours)
        tokenRefreshTimer = Timer.scheduledTimer(withTimeInterval: 23 * 3600, repeats: true) { _ in
            Task {
                await self.refreshAuthToken()
            }
        }
    }
    
    private func refreshAuthToken() async {
        guard let refreshToken = retrieveRefreshToken() else {
            signOut()
            return
        }
        
        do {
            // Simulate token refresh API call
            try await Task.sleep(nanoseconds: 500_000_000)
            
            let newToken = "refreshed_token_\(UUID().uuidString)"
            try storeToken(newToken)
        } catch {
            signOut()
        }
    }
    
    // MARK: - Secure Storage
    
    private func storeToken(_ token: String) throws {
        try storeInKeychain(key: tokenKey, value: token)
    }
    
    private func storeRefreshToken(_ token: String) throws {
        try storeInKeychain(key: refreshTokenKey, value: token)
    }
    
    private func retrieveToken() -> String? {
        return retrieveFromKeychain(key: tokenKey)
    }
    
    private func retrieveRefreshToken() -> String? {
        return retrieveFromKeychain(key: refreshTokenKey)
    }
    
    private func deleteToken() {
        deleteFromKeychain(key: tokenKey)
    }
    
    private func deleteRefreshToken() {
        deleteFromKeychain(key: refreshTokenKey)
    }
    
    private func storeInKeychain(key: String, value: String) throws {
        let data = value.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        SecItemDelete(query as CFDictionary) // Delete existing item
        let status = SecItemAdd(query as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw KeychainError.storeFailed
        }
    }
    
    private func retrieveFromKeychain(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return string
    }
    
    private func deleteFromKeychain(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}

enum KeychainError: Error {
    case storeFailed
    case retrieveFailed
}