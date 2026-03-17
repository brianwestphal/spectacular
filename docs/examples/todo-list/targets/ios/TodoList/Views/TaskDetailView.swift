// Todo List — generated from Spectacular spec

import SwiftUI

struct TaskDetailView: View {
    @State private var task: Task
    @EnvironmentObject var dataService: DataService
    @EnvironmentObject var notificationService: NotificationService
    @Environment({\.dismiss}) var dismiss
    
    @State private var showingDeleteConfirmation = false
    @State private var editingTitle = false
    @State private var titleText = ""
    @State private var saveTimer: Timer?
    
    init(task: Task) {
        self._task = State(initialValue: task)
        self._titleText = State(initialValue: task.title)
    }
    
    var body: some View {
        Form {
            Section {
                if editingTitle {
                    TextField("Task title", text: $titleText, axis: .vertical)
                        .lineLimit(1...3)
                        .onSubmit {
                            saveTitle()
                        }
                        .onChange(of: titleText) { _ in
                            scheduleSave()
                        }
                } else {
                    HStack {
                        Text(task.title)
                            .font(.headline)
                        Spacer()
                        Button("Edit") {
                            editingTitle = true
                            titleText = task.title
                        }
                        .font(.caption)
                    }
                }
            } header: {
                Text("Title")
            } footer: {
                if editingTitle && titleText.count > 200 {
                    Text("Title too long (\(titleText.count)/200)")
                        .foregroundColor(.red)
                }
            }
            
            Section("Status") {
                Toggle("Completed", isOn: Binding(
                    get: { task.isCompleted },
                    set: { newValue in
                        task.isCompleted = newValue
                        saveTask()
                        notificationService.updateBadgeCount(overdueTasks: dataService.overdueTasks)
                    }
                ))
            }
            
            Section("Details") {
                // Due Date
                DatePicker(
                    "Due date",
                    selection: Binding(
                        get: { task.dueDate ?? Date() },
                        set: { newValue in
                            task.dueDate = newValue
                            scheduleSave()
                        }
                    ),
                    displayedComponents: [.date, .time]
                )
                .disabled(task.dueDate == nil)
                
                Toggle("Has due date", isOn: Binding(
                    get: { task.dueDate != nil },
                    set: { hasDate in
                        task.dueDate = hasDate ? Date() : nil
                        scheduleSave()
                    }
                ))
                
                // Priority
                Picker("Priority", selection: Binding(
                    get: { task.priority },
                    set: { newPriority in
                        task.priority = newPriority
                        scheduleSave()
                    }
                )) {
                    ForEach(Task.Priority.allCases, id: \.self) { priority in
                        HStack {
                            if priority != .low {
                                Circle()
                                    .fill(priority.color)
                                    .frame(width: 8, height: 8)
                            }
                            Text(priority.displayName)
                        }
                        .tag(priority)
                    }
                }
                
                // List Assignment
                Picker("List", selection: Binding(
                    get: { task.listId },
                    set: { newListId in
                        task.listId = newListId
                        scheduleSave()
                    }
                )) {
                    ForEach(dataService.lists, id: \.id) { list in
                        HStack {
                            Circle()
                                .fill(list.color ?? .blue)
                                .frame(width: 12, height: 12)
                            Text(list.name)
                        }
                        .tag(list.id)
                    }
                }
            }
            
            Section("Notes") {
                TextField("Notes", text: Binding(
                    get: { task.notes ?? "" },
                    set: { newNotes in
                        task.notes = newNotes.isEmpty ? nil : newNotes
                        scheduleSave()
                    }
                ), axis: .vertical)
                .lineLimit(3...10)
            } footer: {
                if let notes = task.notes, notes.count > 5000 {
                    Text("Notes too long (\(notes.count)/5000)")
                        .foregroundColor(.red)
                }
            }
            
            Section("Metadata") {
                LabeledContent("Created", value: task.createdAt, format: .dateTime)
                LabeledContent("Modified", value: task.updatedAt, format: .dateTime)
                
                if let listName = dataService.lists.first(where: { $0.id == task.listId })?.name {
                    LabeledContent("List", value: listName)
                }
            }
            
            Section {
                Button("Delete Task", role: .destructive) {
                    showingDeleteConfirmation = true
                }
            }
        }
        .navigationTitle("Task Details")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if editingTitle {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        saveTitle()
                    }
                    .disabled(titleText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || titleText.count > 200)
                }
            }
        }
        .alert("Delete Task", isPresented: $showingDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                dataService.deleteTask(task)
                notificationService.cancelReminder(for: task)
                notificationService.updateBadgeCount(overdueTasks: dataService.overdueTasks)
                dismiss()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Are you sure you want to delete \"\(task.title)\"?")
        }
        .onDisappear {
            // Save any pending changes when navigating away
            saveTimer?.invalidate()
            saveTaskImmediately()
        }
    }
    
    private func saveTitle() {
        let trimmedTitle = titleText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty, trimmedTitle.count <= 200 else { return }
        
        task.title = trimmedTitle
        saveTask()
        editingTitle = false
    }
    
    private func scheduleSave() {
        saveTimer?.invalidate()
        saveTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: false) { _ in
            saveTaskImmediately()
        }
    }
    
    private func saveTask() {
        task.updatedAt = Date()
        dataService.updateTask(task)
    }
    
    private func saveTaskImmediately() {
        task.updatedAt = Date()
        dataService.updateTask(task)
    }
}

struct TaskDetailView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            TaskDetailView(task: Task(title: "Sample Task", listId: UUID()))
                .environmentObject(DataService())
                .environmentObject(NotificationService())
        }
    }
}