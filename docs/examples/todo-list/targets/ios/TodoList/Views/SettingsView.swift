// Todo List — generated from Spectacular spec

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var notificationService: NotificationService
    @State private var showingSignOutConfirmation = false
    
    var body: some View {
        NavigationView {
            Form {
                // Profile Section
                Section("Profile") {
                    if let user = authService.currentUser {
                        HStack(spacing: 12) {
                            Image(systemName: "person.circle.fill")
                                .font(.title)
                                .foregroundColor(.blue)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text(user.name ?? "User")
                                    .font(.headline)
                                Text(user.email)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                Text(user.authProvider.rawValue.capitalized)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Capsule().fill(.blue.opacity(0.1)))
                            }
                            
                            Spacer()
                        }
                        .padding(.vertical, 4)
                    }
                }
                
                // Notifications Section
                Section("Notifications") {
                    if notificationService.isAuthorized {
                        Toggle("Enable Notifications", isOn: Binding(
                            get: { notificationService.notificationsEnabled },
                            set: { enabled in
                                notificationService.setNotificationsEnabled(enabled)
                            }
                        ))
                        
                        if notificationService.notificationsEnabled {
                            NavigationLink("Notification Settings") {
                                NotificationSettingsView()
                                    .environmentObject(notificationService)
                            }
                        }
                    } else {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Notifications Disabled")
                                    .font(.body)
                                Text("Enable to get reminders for due tasks")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            
                            Spacer()
                            
                            Button("Enable") {
                                Task {
                                    await notificationService.requestPermission()
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.small)
                        }
                    }
                }
                
                // Data & Sync Section
                Section("Data & Sync") {
                    HStack {
                        Label("Cloud Sync", systemImage: "icloud")
                        Spacer()
                        Text("Enabled")
                            .foregroundColor(.secondary)
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    }
                    
                    HStack {
                        Label("Last Sync", systemImage: "arrow.clockwise")
                        Spacer()
                        if let lastSync = DataService().lastSyncDate {
                            Text(lastSync, style: .relative)
                                .foregroundColor(.secondary)
                        } else {
                            Text("Never")
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Button(action: triggerManualSync) {
                        Label("Sync Now", systemImage: "arrow.clockwise")
                    }
                    .disabled(DataService().isLoading)
                }
                
                // App Section
                Section("App") {
                    NavigationLink(destination: AboutView()) {
                        Label("About", systemImage: "info.circle")
                    }
                    
                    NavigationLink(destination: WebView(url: URL(string: "https://example.com/privacy")!)) {
                        Label("Privacy Policy", systemImage: "hand.raised")
                    }
                    
                    NavigationLink(destination: WebView(url: URL(string: "https://example.com/terms")!)) {
                        Label("Terms of Service", systemImage: "doc.text")
                    }
                    
                    Button(action: openAppStore) {
                        Label("Rate on App Store", systemImage: "star")
                    }
                    
                    ShareLink("Share App", item: URL(string: "https://apps.apple.com/app/todo-list")!) {
                        Label("Share App", systemImage: "square.and.arrow.up")
                    }
                }
                
                // Account Section
                Section("Account") {
                    Button("Sign Out") {
                        showingSignOutConfirmation = true
                    }
                    .foregroundColor(.red)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
        }
        .navigationViewStyle(.stack)
        .alert("Sign Out", isPresented: $showingSignOutConfirmation) {
            Button("Sign Out", role: .destructive) {
                authService.signOut()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Are you sure you want to sign out? Your data will remain synced in the cloud.")
        }
    }
    
    private func triggerManualSync() {
        // This would trigger a manual sync in the real app
        // For now, just simulate the action
    }
    
    private func openAppStore() {
        // This would open the App Store rating page
        if let url = URL(string: "https://apps.apple.com/app/todo-list") {
            UIApplication.shared.open(url)
        }
    }
}

struct NotificationSettingsView: View {
    @EnvironmentObject var notificationService: NotificationService
    
    var body: some View {
        Form {
            Section("Default Reminder Time") {
                DatePicker("Time", selection: Binding(
                    get: { notificationService.defaultReminderTime },
                    set: { newTime in
                        notificationService.defaultReminderTime = newTime
                        notificationService.saveSettings()
                    }
                ), displayedComponents: .hourAndMinute)
            } footer: {
                Text("New tasks with due dates will use this time for reminders by default.")
            }
            
            Section("Quiet Hours") {
                Toggle("Enable Quiet Hours", isOn: Binding(
                    get: { notificationService.quietHoursEnabled },
                    set: { enabled in
                        notificationService.quietHoursEnabled = enabled
                        notificationService.saveSettings()
                    }
                ))
                
                if notificationService.quietHoursEnabled {
                    DatePicker("Start", selection: Binding(
                        get: { notificationService.quietHoursStart },
                        set: { newTime in
                            notificationService.quietHoursStart = newTime
                            notificationService.saveSettings()
                        }
                    ), displayedComponents: .hourAndMinute)
                    
                    DatePicker("End", selection: Binding(
                        get: { notificationService.quietHoursEnd },
                        set: { newTime in
                            notificationService.quietHoursEnd = newTime
                            notificationService.saveSettings()
                        }
                    ), displayedComponents: .hourAndMinute)
                }
            } footer: {
                Text("Notifications will be suppressed during quiet hours. Default is 10:00 PM to 6:59 AM.")
            }
            
            Section("App Badge") {
                HStack {
                    Label("Show Badge Count", systemImage: "app.badge")
                    Spacer()
                    Text("Overdue Tasks")
                        .foregroundColor(.secondary)
                }
            } footer: {
                Text("The app icon will show the number of overdue tasks.")
            }
            
            Section("Permissions") {
                Button("Open Notification Settings") {
                    openNotificationSettings()
                }
                .foregroundColor(.blue)
            } footer: {
                Text("Manage notification permissions in iOS Settings.")
            }
        }
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private func openNotificationSettings() {
        if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(settingsUrl)
        }
    }
}

struct AboutView: View {
    var body: some View {
        Form {
            Section {
                HStack {
                    Spacer()
                    VStack(spacing: 12) {
                        Image(systemName: "checklist")
                            .font(.system(size: 60))
                            .foregroundColor(.blue)
                        
                        Text("Todo List")
                            .font(.title)
                            .fontWeight(.bold)
                        
                        Text("Version 1.0.0")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        
                        Text("Build 2024.1")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
                .padding(.vertical, 20)
            }
            
            Section("Description") {
                Text("A simple task management application for organizing daily tasks across multiple lists. Tasks sync across all your devices in real time with end-to-end encryption.")
                    .font(.body)
            }
            
            Section("Features") {
                FeatureRow(icon: "checkmark.circle", title: "Task Management", description: "Create, complete, and organize tasks with priorities and due dates")
                FeatureRow(icon: "tray.full", title: "Multiple Lists", description: "Organize tasks into custom lists with colors")
                FeatureRow(icon: "bell", title: "Smart Reminders", description: "Get notified about due tasks with customizable timing")
                FeatureRow(icon: "icloud", title: "Cloud Sync", description: "Access tasks from any device with real-time sync")
                FeatureRow(icon: "magnifyingglass", title: "Search", description: "Find tasks quickly across all lists")
                FeatureRow(icon: "lock", title: "Privacy", description: "End-to-end encryption keeps your data secure")
            }
            
            Section("Contact") {
                Button(action: sendFeedback) {
                    Label("Send Feedback", systemImage: "envelope")
                }
                
                Button(action: reportBug) {
                    Label("Report a Bug", systemImage: "ladybug")
                }
                
                Button(action: openSupport) {
                    Label("Get Support", systemImage: "questionmark.circle")
                }
            }
            
            Section("Legal") {
                Text("© 2024 Todo List App. All rights reserved.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .navigationTitle("About")
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private func sendFeedback() {
        if let url = URL(string: "mailto:feedback@todolistapp.com?subject=Feedback") {
            UIApplication.shared.open(url)
        }
    }
    
    private func reportBug() {
        if let url = URL(string: "mailto:support@todolistapp.com?subject=Bug Report") {
            UIApplication.shared.open(url)
        }
    }
    
    private func openSupport() {
        if let url = URL(string: "https://todolistapp.com/support") {
            UIApplication.shared.open(url)
        }
    }
}

struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.blue)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 2)
    }
}

struct WebView: View {
    let url: URL
    
    var body: some View {
        // Placeholder for web view - in a real app you'd use WKWebView
        VStack(spacing: 20) {
            Image(systemName: "globe")
                .font(.system(size: 50))
                .foregroundColor(.blue)
            
            Text("Web Content")
                .font(.title2)
                .fontWeight(.medium)
            
            Text(url.absoluteString)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            
            Button("Open in Safari") {
                UIApplication.shared.open(url)
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle("Web View")
    }
}

struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        SettingsView()
            .environmentObject(AuthService())
            .environmentObject(NotificationService())
    }
}