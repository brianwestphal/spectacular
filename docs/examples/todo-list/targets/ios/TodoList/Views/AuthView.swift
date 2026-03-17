// Todo List — generated from Spectacular spec

import SwiftUI

struct AuthView: View {
    @StateObject private var authService = AuthService()
    @State private var email = ""
    @State private var password = ""
    @State private var showingSignUp = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Spacer()
                
                // Logo/Title
                VStack(spacing: 12) {
                    Image(systemName: "checklist")
                        .font(.system(size: 60))
                        .foregroundColor(.blue)
                    
                    Text("Todo List")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text("Organize your tasks across all devices")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                
                Spacer()
                
                // Sign In Form
                VStack(spacing: 16) {
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .disabled(authService.isLoading)
                    
                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .disabled(authService.isLoading)
                    
                    if let errorMessage = authService.errorMessage {
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                    
                    Button(action: signIn) {
                        HStack {
                            if authService.isLoading {
                                ProgressView()
                                    .scaleEffect(0.8)
                                    .tint(.white)
                            }
                            Text("Sign In")
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    }
                    .disabled(authService.isLoading || email.isEmpty || password.isEmpty)
                }
                
                // Third-party sign in
                VStack(spacing: 12) {
                    Text("Or sign in with")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    HStack(spacing: 16) {
                        Button(action: signInWithGoogle) {
                            HStack {
                                Image(systemName: "globe")
                                Text("Google")
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(Color(.systemGray6))
                            .cornerRadius(8)
                        }
                        .disabled(authService.isLoading)
                        
                        Button(action: signInWithApple) {
                            HStack {
                                Image(systemName: "applelogo")
                                Text("Apple")
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(Color.black)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                        }
                        .disabled(authService.isLoading)
                    }
                }
                
                Spacer()
            }
            .padding()
            .navigationBarHidden(true)
        }
    }
    
    private func signIn() {
        Task {
            await authService.signIn(email: email, password: password)
        }
    }
    
    private func signInWithGoogle() {
        // Placeholder for Google Sign-In
        Task {
            await authService.signIn(email: "user@gmail.com", password: "password")
        }
    }
    
    private func signInWithApple() {
        // Placeholder for Apple Sign-In
        Task {
            await authService.signIn(email: "user@icloud.com", password: "password")
        }
    }
}

struct AuthView_Previews: PreviewProvider {
    static var previews: some View {
        AuthView()
    }
}