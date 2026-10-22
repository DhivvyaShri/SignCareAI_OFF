"""Train a static ISL fingerspelled A-Z image classifier.

Expected dataset structure after extracting the RealSign dataset:
  dataset/Training/A/*.jpg ... dataset/Training/Z/*.jpg
  dataset/Validation/A/*.jpg ... dataset/Validation/Z/*.jpg
  dataset/Testing/A/*.jpg ... dataset/Testing/Z/*.jpg

This is an alphabet fingerspelling prototype, not a full ISL sentence translator.
"""
from pathlib import Path
import json
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "dataset"
MODEL_DIR = ROOT / "models"
IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS = 18


def find_split(name: str) -> Path:
    candidates = [DATA / name, DATA / name.capitalize(), DATA / name.upper()]
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError(f"Could not find {name} folder under {DATA}. See README.md.")


def main():
    train_dir = find_split("training")
    val_dir = find_split("validation")
    test_dir = find_split("testing")
    train_ds = keras.utils.image_dataset_from_directory(train_dir, image_size=IMG_SIZE, batch_size=BATCH_SIZE, label_mode="int", shuffle=True, seed=42)
    class_names = train_ds.class_names
    val_ds = keras.utils.image_dataset_from_directory(val_dir, image_size=IMG_SIZE, batch_size=BATCH_SIZE, label_mode="int", shuffle=False)
    test_ds = keras.utils.image_dataset_from_directory(test_dir, image_size=IMG_SIZE, batch_size=BATCH_SIZE, label_mode="int", shuffle=False)
    if len(class_names) != 26 or class_names != sorted(class_names):
        raise ValueError(f"Expected 26 alphabet folders A-Z sorted alphabetically; found: {class_names}")
    if val_ds.class_names != class_names or test_ds.class_names != class_names:
        raise ValueError("Training, validation and testing folders must contain the same class folders.")

    autotune = tf.data.AUTOTUNE
    train_ds = train_ds.cache().shuffle(1200).prefetch(autotune)
    val_ds = val_ds.cache().prefetch(autotune)
    test_ds = test_ds.cache().prefetch(autotune)
    augment = keras.Sequential([
        layers.RandomRotation(0.05),
        layers.RandomZoom(0.08),
        layers.RandomTranslation(0.05, 0.05),
    ], name="augmentation")
    model = keras.Sequential([
        layers.Input(shape=(*IMG_SIZE, 3)),
        augment,
        layers.Rescaling(1.0 / 255),
        layers.Conv2D(32, 3, padding="same", activation="relu"), layers.MaxPooling2D(),
        layers.Conv2D(64, 3, padding="same", activation="relu"), layers.MaxPooling2D(),
        layers.Conv2D(128, 3, padding="same", activation="relu"), layers.MaxPooling2D(),
        layers.Conv2D(160, 3, padding="same", activation="relu"), layers.GlobalAveragePooling2D(),
        layers.Dropout(0.35), layers.Dense(128, activation="relu"), layers.Dropout(0.25),
        layers.Dense(len(class_names), activation="softmax")
    ])
    model.compile(optimizer=keras.optimizers.Adam(learning_rate=1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    callbacks = [
        keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=5, restore_best_weights=True),
        keras.callbacks.ModelCheckpoint(str(MODEL_DIR / "isl_alphabet.keras"), monitor="val_accuracy", save_best_only=True),
        keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.4, patience=2, min_lr=1e-5),
    ]
    model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS, callbacks=callbacks)
    best_model = keras.models.load_model(MODEL_DIR / "isl_alphabet.keras")
    loss, accuracy = best_model.evaluate(test_ds, verbose=1)
    (MODEL_DIR / "labels.json").write_text(json.dumps(class_names, indent=2), encoding="utf-8")
    report = {"task": "static ISL fingerspelled alphabet classification", "classes": class_names, "test_loss": float(loss), "test_accuracy": float(accuracy), "note": "Evaluation is dataset-specific; it is not clinical validation or full sentence translation."}
    (MODEL_DIR / "evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print("Saved model:", MODEL_DIR / "isl_alphabet.keras")


if __name__ == "__main__":
    main()
