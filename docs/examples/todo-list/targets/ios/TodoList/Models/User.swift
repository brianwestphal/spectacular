// Todo List — generated from Spectacular spec

import Foundation

struct User: Identifiable, Codable {
    let id = UUID()
    var email: String
    var name: String?
    var authProvider: AuthProvider
    var createdAt: Date
    
    enum AuthProvider: String, Codable {
        case email = "email"
        case google = "google"
        case apple = "apple"
    }
    
    init(email: String, name: String? = nil, authProvider: AuthProvider = .email) {
        self.email = email
        self.name = name
        self.authProvider = authProvider
        self.createdAt = Date()
    }
}