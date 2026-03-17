// Todo List — generated from Spectacular spec

import SwiftUI

struct TaskListView: View {
    @EnvironmentObject var dataService: DataService
    @EnvironmentObject var notificationService: NotificationService
    @State private var showingNewTask = false
    @State private var quickAddText = ""
    @State private var taskToDelete: Task?
    @State private var showingDeleteConfirmation = false
    @State private var selectedTask: Task?
    @State private var showingSearch = false
    @State private var searchText = ""
    @State private var isSearching = false
    
    var filteredTasks: [Task] {
        if searchText.isEmpty || !isSearching {
            return dataService.currentTasks
        } else {
            return dataService.tasks.filter { task in
                task.title.localizedCaseInsensitiveContains(searchText) ||
                (task.notes?.localizedCaseInsensitiveContains(searchText) ?? false)
            }.sorted { task1, task2 in
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
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search Bar (when searching)
                if isSearching {
                    searchBarSection
                }
                
                // Quick Add (only when not searching)
                if !isSearching {
                    quickAddSection
                }
                
                // Task List
                if filteredTasks.isEmpty {
                    emptyStateView
                } else {
                    taskListSection
                }
                
                Spacer()
            }
            .navigationTitle(isSearching ? "Search" : currentListName)
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showingNewTask = true }) {
                        Image(systemName: "plus")
                    }
                }
                
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { toggleSearch() }) {
                        Image(systemName: "magnifyingglass")
                    }
                }
            }
            .sheet(isPresented: $showingNewTask) {
                NewTaskView(listId: dataService.currentListId)
                    .environmentObject(dataService)
                    .environmentObject(notificationService)
            }
            .sheet(item: $selectedTask) { task in
                NavigationView {
                    TaskDetailView(task: task)
                        .environmentObject(dataService)
                        .environmentObject(notificationService)
                }
            }
            .alert("Delete Task", isPresented: $showingDeleteConfirmation, presenting: taskToDelete) { task in
                Button("Delete", role: .destructive) {
                    dataService.deleteTask(task)
                    notificationService.cancelReminder(for: task)
                    notificationService.updateBadgeCount(overdueTasks: dataService.overdueTasks)
                }
                Button("Cancel", role: .cancel) { }
            } message: { task in
                Text("Are you sure you want to delete \"\(task.title)\"?")
            }
        }
        .navigationViewStyle(.stack)
        .onReceive(NotificationCenter.default.publisher(for: .showSearch)) { _ in
            toggleSearch()
        }
    }
    
    private var searchBarSection: some View {
        HStack {
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                
                TextField("Search tasks...", text: $searchText)
                    .textFieldStyle(.plain)
                
                if !searchText.isEmpty {
                    Button("Clear") {
                        searchText = ""
                    }
                    .font(.caption)
                    .foregroundColor(.blue)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(.systemGray6))
            .cornerRadius(8)
            
            Button("Cancel") {
                cancelSearch()
            }
            .foregroundColor(.blue)
        }
        .padding()
        .background(Color(.systemBackground))
    }
    
    private var quickAddSection: some View {
        HStack(spacing: 12) {
            TextField("Quick add task...", text: $quickAddText)
                .textFieldStyle(.roundedBorder)
                .onSubmit {
                    addQuickTask()
                }
            
            if !quickAddText.isEmpty {
                Button("Add") {
                    addQuickTask()
                }
                .buttonStyle(.borderedProminent)
                .transition(.scale.combined(with: .opacity))
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .animation(.easeInOut(duration: 0.2), value: quickAddText.isEmpty)
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: isSearching && !searchText.isEmpty ? "doc.text.magnifyingglass" : "checklist")
                .font(.system(size: 60))
                .foregroundColor(.gray)
            
            if isSearching && !searchText.isEmpty {
                Text("No results found")
                    .font(.title2)
                    .fontWeight(.medium)
                
                Text("Try a different search term")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            } else if isSearching {
                Text("Start typing to search")
                    .font(.title2)
                    .fontWeight(.medium)
                
                Text("Search through all your tasks and notes")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            } else {
                Text("No tasks yet")
                    .font(.title2)
                    .fontWeight(.medium)
                
                Text("Add your first task to get started")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                
                Button("Add Task") {
                    showingNewTask = true
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
    
    private var taskListSection: some View {
        List {
            ForEach(filteredTasks) { task in
                if isSearching && !searchText.isEmpty {
                    SearchResultRow(
                        task: task,
                        searchText: searchText,
                        onTap: { selectedTask = task }
                    )
                    .environmentObject(dataService)
                } else {
                    TaskRowView(task: task) {
                        selectedTask = task
                    }
                    .environmentObject(dataService)
                    .environmentObject(notificationService)
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button("Delete") {
                            taskToDelete = task
                            showingDeleteConfirmation = true
                        }
                        .tint(.red)
                    }
                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                        Button(task.isCompleted ? "Incomplete" : "Complete") {
                            toggleTaskCompletion(task)
                        }
                        .tint(.green)
                    }
                }
            }
        }
        .listStyle(.plain)
    }
    
    private var currentListName: String {
        dataService.lists.first(where: { $0.id == dataService.currentListId })?.name ?? "Tasks"
    }
    
    private func toggleSearch() {
        withAnimation(.easeInOut(duration: 0.2)) {
            isSearching.toggle()
            if !isSearching {
                searchText = ""
            }
        }
    }
    
    private func cancelSearch() {
        withAnimation(.easeInOut(duration: 0.2)) {
            isSearching = false
            searchText = ""
        }
    }
    
    private func addQuickTask() {
        guard !quickAddText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        let task = Task(title: quickAddText.trimmingCharacters(in: .whitespacesAndNewlines),
                       listId: dataService.currentListId)
        
        withAnimation(.easeInOut(duration: 0.3)) {
            dataService.addTask(task)
        }
        
        quickAddText = ""
        
        // Request notification permission if this is the first task and user hasn't been asked
        if !notificationService.isAuthorized {
            Task {
                await notificationService.requestPermission()
            }
        }
    }
    
    private func toggleTaskCompletion(_ task: Task) {
        withAnimation(.easeInOut(duration: 0.2)) {
            dataService.toggleTaskCompletion(task)
        }
        
        // Update badge count
        notificationService.updateBadgeCount(overdueTasks: dataService.overdueTasks)
        
        // Haptic feedback
        let impact = UIImpactFeedbackGenerator(style: .light)
        impact.impactOccurred()
    }
}

struct TaskRowView: View {
    let task: Task
    let onTap: () -> Void
    @EnvironmentObject var dataService: DataService
    @EnvironmentObject var notificationService: NotificationService
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Completion Checkbox
                Button(action: { toggleCompletion() }) {
                    Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundColor(task.isCompleted ? .green : .gray)
                        .scaleEffect(task.isCompleted ? 1.1 : 1.0)
                        .animation(.easeInOut(duration: 0.2), value: task.isCompleted)
                }
                .buttonStyle(.plain)
                
                VStack(alignment: .leading, spacing: 4) {
                    // Title
                    HStack {
                        Text(task.title)
                            .font(.body)
                            .strikethrough(task.isCompleted)
                            .foregroundColor(task.isCompleted ? .secondary : .primary)
                            .multilineTextAlignment(.leading)
                        
                        Spacer()
                        
                        // Priority Indicator
                        if task.priority != .low {
                            Circle()
                                .fill(task.priority.color)
                                .frame(width: 8, height: 8)
                        }
                    }
                    
                    // Due Date
                    if let dueDateText = task.dueDateText {
                        Text(dueDateText)
                            .font(.caption)
                            .foregroundColor(task.isOverdue ? .red : .secondary)
                    }
                }
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
    
    private func toggleCompletion() {
        withAnimation(.easeInOut(duration: 0.2)) {
            dataService.toggleTaskCompletion(task)
        }
        
        // Update badge count
        notificationService.updateBadgeCount(overdueTasks: dataService.overdueTasks)
        
        // Haptic feedback
        let impact = UIImpactFeedbackGenerator(style: .light)
        impact.impactOccurred()
    }
}

struct SearchResultRow: View {
    let task: Task
    let searchText: String
    let onTap: () -> Void
    @EnvironmentObject var dataService: DataService
    
    private var listName: String {
        dataService.lists.first(where: { $0.id == task.listId })?.name ?? "Unknown"
    }
    
    private func highlightedText(_ text: String, searchTerm: String) -> Text {
        let parts = text.components(separatedBy: searchTerm)
        var result = Text("")
        
        for (index, part) in parts.enumerated() {
            result = result + Text(part)
            if index < parts.count - 1 {
                result = result + Text(searchTerm).foregroundColor(.blue).fontWeight(.medium)
            }
        }
        
        return result
    }
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Completion Checkbox
                Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundColor(task.isCompleted ? .green : .gray)
                
                VStack(alignment: .leading, spacing: 4) {
                    // Title with highlighting
                    HStack {
                        if task.title.localizedCaseInsensitiveContains(searchText) {
                            highlightedText(task.title, searchTerm: searchText)
                                .font(.body)
                                .strikethrough(task.isCompleted)
                                .foregroundColor(task.isCompleted ? .secondary : .primary)
                                .multilineTextAlignment(.leading)
                        } else {
                            Text(task.title)
                                .font(.body)
                                .strikethrough(task.isCompleted)
                                .foregroundColor(task.isCompleted ? .secondary : .primary)
                                .multilineTextAlignment(.leading)
                        }
                        
                        Spacer()
                        
                        // Priority Indicator
                        if task.priority != .low {
                            Circle()
                                .fill(task.priority.color)
                                .frame(width: 8, height: 8)
                        }
                    }
                    
                    // List and Due Date
                    HStack {
                        Text(listName)
                            .font(.caption)
                            .foregroundColor(.blue)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(.blue.opacity(0.1)))
                        
                        if let dueDateText = task.dueDateText {
                            Text(dueDateText)
                                .font(.caption)
                                .foregroundColor(task.isOverdue ? .red : .secondary)
                        }
                        
                        Spacer()
                    }
                    
                    // Notes preview with highlighting
                    if let notes = task.notes, !notes.isEmpty {
                        if notes.localizedCaseInsensitiveContains(searchText) {
                            highlightedText(notes, searchTerm: searchText)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(2)
                        } else {
                            Text(notes)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(2)
                        }
                    }
                }
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct TaskListView_Previews: PreviewProvider {
    static var previews: some View {
        TaskListView()
            .environmentObject(DataService())
            .environmentObject(NotificationService())
    }
}