import SwiftUI
import PhotosUI
import UIKit

/// Zdjęcia punktów instalacji. Na iPadzie: Documents/photos/{id}.jpg.
/// W meble-app: bucket `scan-photos`, ścieżka `{user_id}/{id}.jpg` (migr. 0048).
enum PhotoStore {
    private static var dir: URL {
        let d = URL.documentsDirectory.appending(path: "photos", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }

    static func url(_ id: String) -> URL { dir.appending(path: "\(id).jpg") }
    static func data(_ id: String) -> Data? { try? Data(contentsOf: url(id)) }

    static func write(_ data: Data, id: String) {
        try? data.write(to: url(id), options: .atomic)
    }

    /// Zapis zdjęcia: dłuższy bok max 2048 px, JPEG ~0,5 MB. Zwraca id.
    static func add(_ image: UIImage) -> String? {
        let maxSide = 2048.0
        let s = image.size
        let k = min(1, maxSide / max(s.width, s.height, 1))
        let target = CGSize(width: (s.width * k).rounded(), height: (s.height * k).rounded())
        let fmt = UIGraphicsImageRendererFormat()
        fmt.scale = 1
        let scaled = UIGraphicsImageRenderer(size: target, format: fmt).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        guard let jpeg = scaled.jpegData(compressionQuality: 0.72) else { return nil }
        let id = UUID().uuidString.lowercased()
        write(jpeg, id: id)
        return id
    }

    /// Usuwa pliki, których nie używa żaden skan zapisany na iPadzie.
    static func prune(keeping ids: Set<String>) {
        let urls = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        for u in urls where u.pathExtension == "jpg" && !ids.contains(u.deletingPathExtension().lastPathComponent) {
            try? FileManager.default.removeItem(at: u)
        }
    }
}

/// Miniatura zdjęcia: z iPada, a gdy go nie ma (skan pobrany z meble-app) — z serwera.
struct PhotoThumb: View {
    let id: String
    var fill = true
    @EnvironmentObject private var session: Session
    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        ZStack {
            if fill { Color(.secondarySystemBackground) }
            if let image {
                Image(uiImage: image).resizable().aspectRatio(contentMode: fill ? .fill : .fit)
            } else if failed {
                Image(systemName: "photo.badge.exclamationmark").foregroundStyle(.secondary)
            } else {
                ProgressView()
            }
        }
        .clipped()
        .task(id: id) { await load() }
    }

    private func load() async {
        if let d = PhotoStore.data(id) {
            image = UIImage(data: d)
            return
        }
        do {
            let d = try await session.downloadPhoto(id)
            PhotoStore.write(d, id: id)
            image = UIImage(data: d)
        } catch {
            failed = true
        }
    }
}

/// Zdjęcie na cały ekran, z usuwaniem.
struct PhotoViewer: View {
    let ids: [String]
    @State var index: Int
    let onDelete: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            TabView(selection: $index) {
                ForEach(Array(ids.enumerated()), id: \.element) { i, id in
                    PhotoThumb(id: id, fill: false)
                        .tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: ids.count > 1 ? .always : .never))
            .background(Color.black)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Zamknij") { dismiss() } }
                ToolbarItem(placement: .destructiveAction) {
                    Button(role: .destructive) {
                        guard ids.indices.contains(index) else { return }
                        onDelete(ids[index])
                        dismiss()
                    } label: { Label("Usuń zdjęcie", systemImage: "trash") }
                }
            }
            .toolbarBackground(.visible, for: .navigationBar)
        }
    }
}

/// Aparat (UIImagePickerController) — zdjęcie wraca jako UIImage.
struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let c = UIImagePickerController()
        c.sourceType = .camera
        c.delegate = context.coordinator
        return c
    }

    func updateUIViewController(_ c: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ p: CameraPicker) { parent = p }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let img = info[.originalImage] as? UIImage { parent.onImage(img) }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}

/// Sekcja „Zdjęcia" w karcie punktu: miniatury + aparat + galeria.
struct MarkerPhotosSection: View {
    @Binding var photos: [String]

    @State private var camera = false
    @State private var picked: [PhotosPickerItem] = []
    @State private var viewing: Int?
    @State private var importing = false

    var body: some View {
        Section {
            if !photos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(photos.enumerated()), id: \.element) { i, id in
                            PhotoThumb(id: id)
                                .frame(width: 110, height: 110)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .onTapGesture { viewing = i }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            HStack {
                Button { camera = true } label: { Label("Zrób zdjęcie", systemImage: "camera") }
                    .buttonStyle(.bordered)
                    .disabled(!UIImagePickerController.isSourceTypeAvailable(.camera))
                PhotosPicker(selection: $picked, maxSelectionCount: 6, matching: .images) {
                    Label("Z galerii", systemImage: "photo.on.rectangle")
                }
                .buttonStyle(.bordered)
                if importing { ProgressView().padding(.leading, 6) }
            }
        } header: {
            Text("Zdjęcia")
        } footer: {
            Text("Np. zawór, puszka, rura z bliska i z dalszej perspektywy — trafią do zlecenia razem ze skanem.")
        }
        .fullScreenCover(isPresented: $camera) {
            CameraPicker { img in
                if let id = PhotoStore.add(img) { photos.append(id) }
            }
            .ignoresSafeArea()
        }
        .sheet(item: Binding(get: { viewing.map(ViewIndex.init) }, set: { viewing = $0?.i })) { v in
            PhotoViewer(ids: photos, index: v.i) { id in photos.removeAll { $0 == id } }
        }
        .onChange(of: picked) { _, items in
            guard !items.isEmpty else { return }
            importing = true
            Task {
                for item in items {
                    if let d = try? await item.loadTransferable(type: Data.self), let img = UIImage(data: d),
                       let id = PhotoStore.add(img) {
                        photos.append(id)
                    }
                }
                picked = []
                importing = false
            }
        }
    }

    private struct ViewIndex: Identifiable {
        let i: Int
        var id: Int { i }
    }
}
