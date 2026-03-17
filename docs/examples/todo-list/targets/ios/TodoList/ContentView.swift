// Todo List — generated from Spectacular spec

import SwiftUI

struct ContentView: View {
    @StateObject private var authService = AuthService()
    @StateObject private var dataService = DataService()
    @StateObject private var notificationService = NotificationService()
    @State private var selectedTab: Tab = .tasks
    @State private var showingNewTask = false
    @State private var showingSearch = false
    
    enum Tab {
        case tasks, lists, settings
    }
    
    var body: some View {
        if authService.isAuthenticated {
            mainAppView
        } else {
            AuthView()
                .environmentObject(authService)
        }
    }
    
    private var mainAppView: some View {
        VStack(spacing: 0) {
            // Main Content
            Group {
                switch selectedTab {
                case .tasks:
                    TaskListView()
                        .environmentObject(dataService)
                        .environmentObject(notificationService)
                case .lists:
                    ListSelectorView()
                        .environmentObject(dataService)
                case .settings:
                    SettingsView()
                        .environmentObject(authService)
                        .environmentObject(notificationService)
                }
            }
            .transition(.opacity.animation(.easeInOut(duration: 0.2)))
            
            // Bottom Toolbar
            bottomToolbar
        }
        .sheet(isPresented: $showingNewTask) {
            NewTaskView(listId: dataService.currentListId)
                .environmentObject(dataService)
                .environmentObject(notificationService)
        }
        .sheet(isPresented: $showingSearch) {
            TaskSearchView()
                .environmentObject(dataService)
        }
        .onReceive(NotificationCenter.default.publisher(for: .completeTaskFromNotification)) { notification in
            if let taskId = notification.object as? UUID {
                completeTaskFromNotification(taskId: taskId)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .openTaskFromNotification)) { notification in
            if let taskId = notification.object as? UUID {
                openTaskFromNotification(taskId: taskId)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .snoozeTaskReminder)) { notification in
            if let userInfo = notification.object as? [String: Any],
               let taskId = userInfo["taskId"] as? UUID,
               let snoozeTime = userInfo["snoozeTime"] as? Date {
                snoozeTaskReminder(taskId: taskId, snoozeTime: snoozeTime)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .showNewTask)) { _ in
            showingNewTask = true
        }
        .onReceive(NotificationCenter.default.publisher(for: .showSearch)) { _ in
            showingSearch = true
        }
        .onAppear {
            notificationService.updateBadgeCount(overdueTasks: dataService.overdueTasks)
        }
    }
    
    private var bottomToolbar: some View {
        HStack {
            // Tasks Tab
            Button(action: { selectTab(.tasks) }) {
                VStack(spacing: 4) {
                    Image(systemName: selectedTab == .tasks ? "checklist" : "checklist")
                        .font(.system(size: 20, weight: selectedTab == .tasks ? .semibold : .regular))
                    
                    if selectedTab == .tasks {
                        Text("Tasks")
                            .font(.caption2)
                            .fontWeight(.medium)
                    }
                }
                .foregroundColor(selectedTab == .tasks ? .blue : .gray)
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            
            // Lists Tab
            Button(action: { selectTab(.lists) }) {
                VStack(spacing: 4) {
                    Image(systemName: selectedTab == .lists ? "tray.full.fill" : "tray.full")
                        .font(.system(size: 20, weight: selectedTab == .lists ? .semibold : .regular))
                    
                    if selectedTab == .lists {
                        Text("Lists")
                            .font(.caption2)
                            .fontWeight(.medium)
                    }
                }
                .foregroundColor(selectedTab == .lists ? .blue : .gray)
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            
            // Settings Tab
            Button(action: { selectTab(.settings) }) {
                VStack(spacing: 4) {
                    Image(systemName: selectedTab == .settings ? "gearshape.fill" : "gearshape")
                        .font(.system(size: 20, weight: selectedTab == .settings ? .semibold : .regular))
                    
                    if selectedTab == .settings {
                        Text("Settings")
                            .font(.caption2)
                            .fontWeight(.medium)
                    }
                }
                .foregroundColor(selectedTab == .settings ? .blue : .gray)
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
        }
        .padding(.top, 8)
        .padding(.bottom, 8)
        .background(Color(.systemBackground))
        .overlay(alignment: .top) {
            Divider()
        }
    }
    
    private func selectTab(_ tab: Tab) {
        withAnimation(.easeInOut(duration: 0.2)) {
            selectedTab = tab
        }
    }
    
    private func completeTaskFromNotification(taskId: UUID) {
        if let task = dataService.tasks.first(where: { $0.id == taskId }) {
            dataService.toggleTaskCompletion(task)
            notificationService.updateBadgeCount(overdueTasks: dataService.overdueTasks)
        }
    }
    
    private func openTaskFromNotification(taskId: UUID) {
        if let task = dataService.tasks.first(where: { $0.id == taskId }) {
            // Switch to the task's list
            dataService.switchToList(task.listId)
            selectedTab = .tasks
            // TODO: Navigate to task detail
        }
    }
    
    private func snoozeTaskReminder(taskId: UUID, snoozeTime: Date) {
        if let task = dataService.tasks.first(where: { $0.id == taskId }) {
            notificationService.scheduleReminder(for: task, at: snoozeTime)
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}