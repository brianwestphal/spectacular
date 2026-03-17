// Todo List — generated from Spectacular spec

import SwiftUI

@main
struct TodoListApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        
        // Configure 3D Touch Quick Actions
        configureQuickActions()
        
        return true
    }
    
    func application(_ application: UIApplication, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        
        switch shortcutItem.type {
        case "NewTask":
            // Post notification to show new task view
            NotificationCenter.default.post(name: .showNewTask, object: nil)
            completionHandler(true)
            
        case "Search":
            // Post notification to show search view
            NotificationCenter.default.post(name: .showSearch, object: nil)
            completionHandler(true)
            
        default:
            completionHandler(false)
        }
    }
    
    private func configureQuickActions() {
        let newTaskAction = UIApplicationShortcutItem(
            type: "NewTask",
            localizedTitle: "New Task",
            localizedSubtitle: nil,
            icon: UIApplicationShortcutIcon(systemImageName: "plus"),
            userInfo: nil
        )
        
        let searchAction = UIApplicationShortcutItem(
            type: "Search",
            localizedTitle: "Search",
            localizedSubtitle: nil,
            icon: UIApplicationShortcutIcon(systemImageName: "magnifyingglass"),
            userInfo: nil
        )
        
        UIApplication.shared.shortcutItems = [newTaskAction, searchAction]
    }
}

// MARK: - Notification Names for Quick Actions
extension Notification.Name {
    static let showNewTask = Notification.Name("showNewTask")
    static let showSearch = Notification.Name("showSearch")
}