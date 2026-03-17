// Todo List — generated from Spectacular spec

import SwiftUI

struct ListSelectorView: View {
    @EnvironmentObject var dataService: DataService
    @State private var showingNewList = false
    @State private var listToDelete: TodoList?
    @State private var showingDeleteConfirmation = false
    @State private var editingList: TodoList?
    
    var body: some View {
        NavigationView {
            List {
                ForEach(dataService.lists, id: \.id) { list in
                    ListRowView(list: list, isSelected: list.id == dataService.currentListId) {
                        selectList(list)
                    }
                    .environmentObject(dataService)
                    .swipeActions(edge: .trailing) {
                        if !list.isDefault {
                            Button("Delete") {
                                listToDelete = list
                                showingDeleteConfirmation = true
                            }
                            .tint(.red)
                            
                            Button("Edit") {
                                editingList = list
                            }
                            .tint(.blue)
                        }
                    }
                }
                .onMove(perform: moveList)
            }
            .navigationTitle("Lists")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showingNewList = true }) {
                        Image(systemName: "plus")
                    }
                }
                
                ToolbarItem(placement: .navigationBarLeading) {
                    EditButton()
                }
            }
        }
        .navigationViewStyle(.stack)
        .sheet(isPresented: $showingNewList) {
            NewListView()
                .environmentObject(dataService)
        }
        .sheet(item: $editingList) { list in
            EditListView(list: list)
                .environmentObject(dataService)
        }
        .alert("Delete List", isPresented: $showingDeleteConfirmation, presenting: listToDelete) { list in
            Button("Delete", role: .destructive) {
                dataService.deleteList(list)
            }
            Button("Cancel", role: .cancel) { }
        } message: { list in
            Text("Are you sure you want to delete \"\(list.name)\"? All tasks will be moved to Inbox.")
        }
    }
    
    private func selectList(_ list: TodoList) {
        withAnimation(.easeInOut(duration: 0.2)) {
            dataService.switchToList(list.id)
        }
    }
    
    private func moveList(from source: IndexSet, to destination: Int) {
        var lists = dataService.lists
        lists.move(fromOffsets: source, toOffset: destination)
        
        // Update the lists in data service
        // This would typically involve updating the sort order in the backend
        // For now, we'll just reorder the local array
    }
}

struct ListRowView: View {
    let list: TodoList
    let isSelected: Bool
    let onTap: () -> Void
    @EnvironmentObject var dataService: DataService
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // List Color Indicator
                Circle()
                    .fill(list.color ?? .blue)
                    .frame(width: 12, height: 12)
                
                // List Name
                Text(list.name)
                    .font(.body)
                    .foregroundColor(.primary)
                    .fontWeight(isSelected ? .medium : .regular)
                
                Spacer()
                
                // Unfinished Task Count Badge
                let unfinishedCount = dataService.unfinishedTaskCount(for: list.id)
                if unfinishedCount > 0 {
                    Text("\(unfinishedCount)")
                        .font(.caption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(.blue))
                        .transition(.scale.combined(with: .opacity))
                }
                
                // Selection Indicator
                if isSelected {
                    Image(systemName: "checkmark")
                        .foregroundColor(.blue)
                        .font(.body.weight(.semibold))
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
        .animation(.easeInOut(duration: 0.2), value: dataService.unfinishedTaskCount(for: list.id))
    }
}

struct NewListView: View {
    @EnvironmentObject var dataService: DataService
    @Environment({\.dismiss}) var dismiss
    
    @State private var name = ""
    @State private var selectedColor: Color = .blue
    
    private let availableColors: [Color] = [
        .blue, .green, .orange, .red, .purple, .pink, .yellow, .teal, .indigo, .brown
    ]
    
    var body: some View {
        NavigationView {
            Form {
                Section {
                    TextField("List name", text: $name)
                        .autocorrectionDisabled()
                } header: {
                    Text("Name")
                } footer: {
                    if name.count > 50 {
                        Text("Name too long (\(name.count)/50)")
                            .foregroundColor(.red)
                    } else if !name.isEmpty && dataService.lists.contains(where: { $0.name.lowercased() == name.lowercased() }) {
                        Text("A list with this name already exists")
                            .foregroundColor(.red)
                    }
                }
                
                Section("Color") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 16) {
                        ForEach(availableColors, id: \.self) { color in
                            Button(action: { selectedColor = color }) {
                                Circle()
                                    .fill(color)
                                    .frame(width: 30, height: 30)
                                    .overlay {
                                        if selectedColor == color {
                                            Circle()
                                                .stroke(Color.primary, lineWidth: 3)
                                        }
                                    }
                                    .scaleEffect(selectedColor == color ? 1.1 : 1.0)
                                    .animation(.easeInOut(duration: 0.2), value: selectedColor == color)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            .navigationTitle("New List")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Add") {
                        addList()
                    }
                    .disabled(!canAddList)
                }
            }
        }
    }
    
    private var canAddList: Bool {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmedName.isEmpty &&
               trimmedName.count <= 50 &&
               !dataService.lists.contains(where: { $0.name.lowercased() == trimmedName.lowercased() })
    }
    
    private func addList() {
        let list = TodoList(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            color: selectedColor
        )
        
        dataService.addList(list)
        dismiss()
    }
}

struct EditListView: View {
    let list: TodoList
    @EnvironmentObject var dataService: DataService
    @Environment({\.dismiss}) var dismiss
    
    @State private var name: String
    @State private var selectedColor: Color
    
    private let availableColors: [Color] = [
        .blue, .green, .orange, .red, .purple, .pink, .yellow, .teal, .indigo, .brown
    ]
    
    init(list: TodoList) {
        self.list = list
        self._name = State(initialValue: list.name)
        self._selectedColor = State(initialValue: list.color ?? .blue)
    }
    
    var body: some View {
        NavigationView {
            Form {
                Section {
                    TextField("List name", text: $name)
                        .autocorrectionDisabled()
                } header: {
                    Text("Name")
                } footer: {
                    if name.count > 50 {
                        Text("Name too long (\(name.count)/50)")
                            .foregroundColor(.red)
                    } else if !name.isEmpty && name.lowercased() != list.name.lowercased() && dataService.lists.contains(where: { $0.name.lowercased() == name.lowercased() }) {
                        Text("A list with this name already exists")
                            .foregroundColor(.red)
                    }
                }
                
                Section("Color") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 16) {
                        ForEach(availableColors, id: \.self) { color in
                            Button(action: { selectedColor = color }) {
                                Circle()
                                    .fill(color)
                                    .frame(width: 30, height: 30)
                                    .overlay {
                                        if selectedColor == color {
                                            Circle()
                                                .stroke(Color.primary, lineWidth: 3)
                                        }
                                    }
                                    .scaleEffect(selectedColor == color ? 1.1 : 1.0)
                                    .animation(.easeInOut(duration: 0.2), value: selectedColor == color)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            .navigationTitle("Edit List")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveList()
                    }
                    .disabled(!canSaveList)
                }
            }
        }
    }
    
    private var canSaveList: Bool {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmedName.isEmpty &&
               trimmedName.count <= 50 &&
               (trimmedName.lowercased() == list.name.lowercased() || !dataService.lists.contains(where: { $0.name.lowercased() == trimmedName.lowercased() }))
    }
    
    private func saveList() {
        var updatedList = list
        updatedList.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        updatedList.color = selectedColor
        
        dataService.updateList(updatedList)
        dismiss()
    }
}

struct ListSelectorView_Previews: PreviewProvider {
    static var previews: some View {
        ListSelectorView()
            .environmentObject(DataService())
    }
}