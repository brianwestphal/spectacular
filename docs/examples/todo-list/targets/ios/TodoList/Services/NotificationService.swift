// Todo List — generated from Spectacular spec

import Foundation
import UserNotifications
import Combine

class NotificationService: NSObject, ObservableObject {
    @Published var isAuthorized = false
    @Published var notificationsEnabled = true
    @Published var quietHoursEnabled = true
    @Published var quietHoursStart = Calendar.current.date(bySettingHour: 22, minute: 0, second: 0, of: Date()) ?? Date()
    @Published var quietHoursEnd = Calendar.current.date(bySettingHour: 7, minute: 0, second: 0, of: Date()) ?? Date()
    @Published var defaultReminderTime = Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: Date()) ?? Date()
    
    private let center = UNUserNotificationCenter.current()
    private let settingsKey = "notification_settings"
    
    override init() {
        super.init()
        center.delegate = self
        checkAuthorizationStatus()
        loadSettings()
    }
    
    func requestPermission() async -> Bool {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            await MainActor.run {
                self.isAuthorized = granted
            }
            
            if granted {
                await registerCategories()
            }
            
            return granted
        } catch {
            return false
        }
    }
    
    func scheduleReminder(for task: Task, at reminderTime: Date) {
        guard isAuthorized && notificationsEnabled else { return }
        
        // Check quiet hours
        if quietHoursEnabled && isInQuietHours(reminderTime) {
            return
        }
        
        let content = UNMutableNotificationContent()
        content.title = task.title
        content.body = "Due today - \(getListName(for: task.listId))"
        content.sound = .default
        content.categoryIdentifier = "TASK_REMINDER"
        content.userInfo = ["taskId": task.id.uuidString]
        
        let calendar = Calendar.current
        let dateComponents = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: reminderTime)
        
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: false)
        let identifier = "task_\(task.id.uuidString)_\(reminderTime.timeIntervalSince1970)"
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
        
        center.add(request) { error in
            if let error = error {
                print("Failed to schedule notification: \(error)")
            }
        }
    }
    
    func cancelReminder(for task: Task) {
        // Cancel all notifications for this task (including additional reminders)
        center.getPendingNotificationRequests { requests in
            let taskNotifications = requests.filter { request in
                request.identifier.hasPrefix("task_\(task.id.uuidString)")
            }
            let identifiers = taskNotifications.map { $0.identifier }
            self.center.removePendingNotificationRequests(withIdentifiers: identifiers)
        }
    }
    
    func updateBadgeCount(overdueTasks: [Task]) {
        let count = overdueTasks.filter { !$0.isCompleted }.count
        UNUserNotificationCenter.current().setBadgeCount(count) { error in
            if let error = error {
                print("Failed to update badge count: \(error)")
            }
        }
    }
    
    private func registerCategories() async {
        let completeAction = UNNotificationAction(
            identifier: "COMPLETE_ACTION",
            title: "Complete",
            options: []
        )
        
        let snoozeAction = UNNotificationAction(
            identifier: "SNOOZE_ACTION",
            title: "Snooze (1 hour)",
            options: []
        )
        
        let category = UNNotificationCategory(
            identifier: "TASK_REMINDER",
            actions: [completeAction, snoozeAction],
            intentIdentifiers: [],
            options: []
        )
        
        center.setNotificationCategories([category])
    }
    
    private func checkAuthorizationStatus() {
        center.getNotificationSettings { settings in
            DispatchQueue.main.async {
                self.isAuthorized = settings.authorizationStatus == .authorized
            }
        }
    }
    
    private func isInQuietHours(_ date: Date) -> Bool {
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: date)
        let startHour = calendar.component(.hour, from: quietHoursStart)
        let endHour = calendar.component(.hour, from: quietHoursEnd)
        
        if startHour <= endHour {
            return hour >= startHour && hour < endHour
        } else {
            return hour >= startHour || hour < endHour
        }
    }
    
    private func loadSettings() {
        if let data = UserDefaults.standard.data(forKey: settingsKey),
           let settings = try? JSONDecoder().decode(NotificationSettings.self, from: data) {
            notificationsEnabled = settings.enabled
            quietHoursEnabled = settings.quietHoursEnabled
            quietHoursStart = settings.quietHoursStart
            quietHoursEnd = settings.quietHoursEnd
            defaultReminderTime = settings.defaultReminderTime
        }
    }
    
    func saveSettings() {
        let settings = NotificationSettings(
            enabled: notificationsEnabled,
            quietHoursEnabled: quietHoursEnabled,
            quietHoursStart: quietHoursStart,
            quietHoursEnd: quietHoursEnd,
            defaultReminderTime: defaultReminderTime
        )
        
        if let data = try? JSONEncoder().encode(settings) {
            UserDefaults.standard.set(data, forKey: settingsKey)
        }
    }
    
    func setNotificationsEnabled(_ enabled: Bool) {
        notificationsEnabled = enabled
        saveSettings()
    }
    
    private func getListName(for listId: UUID) -> String {
        // This is a placeholder - in a real app this would be injected or accessed through a shared service
        return "List"
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension NotificationService: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        
        let userInfo = response.notification.request.content.userInfo
        guard let taskIdString = userInfo["taskId"] as? String,
              let taskId = UUID(uuidString: taskIdString) else {
            completionHandler()
            return
        }
        
        switch response.actionIdentifier {
        case "COMPLETE_ACTION":
            // Notify app to complete task
            NotificationCenter.default.post(name: .completeTaskFromNotification, object: taskId)
            
        case "SNOOZE_ACTION":
            // Schedule new reminder in 1 hour
            let snoozeTime = Date().addingTimeInterval(3600) // 1 hour
            NotificationCenter.default.post(name: .snoozeTaskReminder, object: ["taskId": taskId, "snoozeTime": snoozeTime])
            
        default:
            // Notification was tapped - open task detail
            NotificationCenter.default.post(name: .openTaskFromNotification, object: taskId)
        }
        
        completionHandler()
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // Show notification even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }
}

// MARK: - Models

struct NotificationSettings: Codable {
    let enabled: Bool
    let quietHoursEnabled: Bool
    let quietHoursStart: Date
    let quietHoursEnd: Date
    let defaultReminderTime: Date
}

// MARK: - Notification Names

extension Notification.Name {
    static let completeTaskFromNotification = Notification.Name("completeTaskFromNotification")
    static let snoozeTaskReminder = Notification.Name("snoozeTaskReminder")
    static let openTaskFromNotification = Notification.Name("openTaskFromNotification")
}