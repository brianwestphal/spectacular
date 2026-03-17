// Todo List — generated from Spectacular spec

import Foundation
import Combine

class DataService: ObservableObject {
    @Published var tasks: [Task] = []
    @Published var lists: [TodoList] = []
    @Published var currentListId: UUID
    @Published var isLoading = false
    @Published var lastSyncDate: Date?
    
    private let tasksKey = "saved_tasks"
    private let listsKey = "saved_lists"
    private let currentListKey = "current_list_id"
    private let lastSyncKey = "last_sync_date"
    
    private var syncTimer: Timer?
    private let syncInterval: TimeInterval = 5.0 // 5 seconds
    
    init() {
        // Initialize with Inbox list
        let inboxList = TodoList.inbox
        self.currentListId = inboxList.id
        
        loadData()
        
        // Ensure Inbox exists
        if lists.isEmpty {
            lists = [inboxList]
            saveLists()
        }
        
        // Start sync timer
        startSyncTimer()
    }
    
    // MARK: - Task Management
    
    func addTask(_ task: Task) {
        tasks.append(task)
        saveTasks()
        syncToCloud()
    }
    
    func updateTask(_ task: Task) {
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            var updatedTask = task
            updatedTask.updatedAt = Date()
            tasks[index] = updatedTask
            saveTasks()
            syncToCloud()
        }
    }
    
    func deleteTask(_ task: Task) {
        tasks.removeAll { $0.id == task.id }
        saveTasks()
        syncToCloud()
    }
    
    func toggleTaskCompletion(_ task: Task) {
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            tasks[index].isCompleted.toggle()
            tasks[index].updatedAt = Date()
            saveTasks()
            syncToCloud()
        }
    }
    
    // MARK: - List Management
    
    func addList(_ list: TodoList) {
        guard !lists.contains(where: { $0.name.lowercased() == list.name.lowercased() }) else { return }
        lists.append(list)
        saveLists()
        syncToCloud()
    }
    
    func updateList(_ list: TodoList) {
        if let index = lists.firstIndex(where: { $0.id == list.id }) {
            var updatedList = list
            updatedList.updatedAt = Date()
            lists[index] = updatedList
            saveLists()
            syncToCloud()
        }
    }
    
    func deleteList(_ list: TodoList) {
        guard !list.isDefault else { return } // Cannot delete Inbox
        
        // Move all tasks to Inbox
        let inboxId = lists.first(where: { $0.isDefault })?.id ?? TodoList.inbox.id
        for index in tasks.indices {
            if tasks[index].listId == list.id {
                tasks[index].listId = inboxId
                tasks[index].updatedAt = Date()
            }
        }
        
        lists.removeAll { $0.id == list.id }
        
        // Switch to Inbox if we're deleting the current list
        if currentListId == list.id {
            currentListId = inboxId
            UserDefaults.standard.set(inboxId.uuidString, forKey: currentListKey)
        }
        
        saveTasks()
        saveLists()
        syncToCloud()
    }
    
    func switchToList(_ listId: UUID) {
        currentListId = listId
        UserDefaults.standard.set(listId.uuidString, forKey: currentListKey)
    }
    
    // MARK: - Computed Properties
    
    var currentTasks: [Task] {
        tasks.filter { $0.listId == currentListId }
            .sorted { task1, task2 in
                // First sort by completion status
                if task1.isCompleted != task2.isCompleted {
                    return !task1.isCompleted
                }
                
                // For active tasks, sort by priority, then due date, then creation date
                if !task1.isCompleted && !task2.isCompleted {
                    if task1.priority != task2.priority {
                        return task1.priority.rawValue > task2.priority.rawValue
                    }
                    
                    if let date1 = task1.dueDate, let date2 = task2.dueDate {
                        return date1 < date2
                    } else if task1.dueDate != nil {
                        return true
                    } else if task2.dueDate != nil {
                        return false
                    }
                    
                    return task1.createdAt > task2.createdAt
                }
                
                // For completed tasks, sort by completion date (most recent first)
                return task1.updatedAt > task2.updatedAt
            }
    }
    
    var overdueTasks: [Task] {
        tasks.filter { $0.isOverdue && !$0.isCompleted }
    }
    
    func unfinishedTaskCount(for listId: UUID) -> Int {
        tasks.filter { $0.listId == listId && !$0.isCompleted }.count
    }
    
    // MARK: - Persistence
    
    private func loadData() {
        loadTasks()
        loadLists()
        loadCurrentList()
        loadLastSyncDate()
    }
    
    private func loadTasks() {
        guard let data = UserDefaults.standard.data(forKey: tasksKey),
              let decodedTasks = try? JSONDecoder().decode([Task].self, from: data) else {
            return
        }
        tasks = decodedTasks
    }
    
    private func saveTasks() {
        if let data = try? JSONEncoder().encode(tasks) {
            UserDefaults.standard.set(data, forKey: tasksKey)
        }
    }
    
    private func loadLists() {
        guard let data = UserDefaults.standard.data(forKey: listsKey),
              let decodedLists = try? JSONDecoder().decode([TodoList].self, from: data) else {
            return
        }
        lists = decodedLists
    }
    
    private func saveLists() {
        if let data = try? JSONEncoder().encode(lists) {
            UserDefaults.standard.set(data, forKey: listsKey)
        }
    }
    
    private func loadCurrentList() {
        guard let uuidString = UserDefaults.standard.string(forKey: currentListKey),
              let uuid = UUID(uuidString: uuidString) else {
            return
        }
        currentListId = uuid
    }
    
    private func loadLastSyncDate() {
        if let date = UserDefaults.standard.object(forKey: lastSyncKey) as? Date {
            lastSyncDate = date
        }
    }
    
    // MARK: - Cloud Sync
    
    private func startSyncTimer() {
        syncTimer = Timer.scheduledTimer(withTimeInterval: syncInterval, repeats: true) { _ in
            Task {
                await self.performCloudSync()
            }
        }
    }
    
    private func syncToCloud() {
        // Trigger immediate sync for user actions
        Task {
            await performCloudSync()
        }
    }
    
    private func performCloudSync() async {
        await MainActor.run {
            isLoading = true
        }
        
        // Simulate cloud sync with network delay
        do {
            try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
            
            await MainActor.run {
                self.lastSyncDate = Date()
                UserDefaults.standard.set(self.lastSyncDate, forKey: self.lastSyncKey)
                self.isLoading = false
            }
            
            print("Synced to cloud at \(Date())")
        } catch {
            await MainActor.run {
                self.isLoading = false
            }
            print("Sync failed: \(error)")
        }
    }
    
    deinit {
        syncTimer?.invalidate()
    }
}