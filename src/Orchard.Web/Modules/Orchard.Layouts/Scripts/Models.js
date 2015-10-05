var LayoutEditor;
(function (LayoutEditor) {

    Array.prototype.move = function (from, to) {
        this.splice(to, 0, this.splice(from, 1)[0]);
    };

    LayoutEditor.childrenFrom = function(values) {
        return _(values).map(function(value) {
            return LayoutEditor.elementFrom(value);
        });
    };

    var registerFactory = LayoutEditor.registerFactory = function(type, factory) {
        var factories = LayoutEditor.factories = LayoutEditor.factories || {};
        factories[type] = factory;
    };

    registerFactory("Canvas", function (value) { return LayoutEditor.Canvas.from(value); });
    registerFactory("Grid", function(value) { return LayoutEditor.Grid.from(value); });
    registerFactory("Row", function(value) { return LayoutEditor.Row.from(value); });
    registerFactory("Column", function(value) { return LayoutEditor.Column.from(value); });
    registerFactory("Content", function(value) { return LayoutEditor.Content.from(value); });

    LayoutEditor.elementFrom = function (value) {
        var factory = LayoutEditor.factories[value.type];

        if (!factory)
            throw new Error("No element with type \"" + value.type + "\" was found.");

        var element = factory(value);
        return element;
    };

    LayoutEditor.setModel = function (elementSelector, model) {
        $(elementSelector).scope().element = model;
    };

    LayoutEditor.getModel = function (elementSelector) {
        return $(elementSelector).scope().element;
    };

})(LayoutEditor || (LayoutEditor = {}));
var LayoutEditor;
(function (LayoutEditor) {

    LayoutEditor.Editor = function (config, canvasData) {
        this.config = config;
        this.canvas = LayoutEditor.Canvas.from(canvasData);
        this.initialState = JSON.stringify(this.canvas.toObject());
        this.activeElement = null;
        this.focusedElement = null;
        this.dropTargetElement = null;
        this.isDragging = false;
        this.isResizing = false;
        this.recycleBin = new LayoutEditor.RecycleBin();

        this.resetToolboxElements = function () {
            this.toolboxElements = [
                LayoutEditor.Row.from({
                    children: []
                })
            ];
        };

        this.isDirty = function() {
            var currentState = JSON.stringify(this.canvas.toObject());
            return this.initialState != currentState;
        };

        this.resetToolboxElements();
        this.canvas.setEditor(this);
    };

})(LayoutEditor || (LayoutEditor = {}));

var LayoutEditor;
(function (LayoutEditor) {

    LayoutEditor.RecycleBin = function () {
        this.elements = [];

        this.add = function(element) {
            this.elements.push(element);
        };

        this.toObject = function () {
            var result = {
                type: "RecycleBin",
                children: []
            };

            for (var i = 0; i < this.elements.length; i++) {
                var element = this.elements[i];
                var dto = element.toObject();
                result.children.push(dto);
            }

            return result;
        };
    };

})(LayoutEditor || (LayoutEditor = {}));

var LayoutEditor;
(function (LayoutEditor) {

    LayoutEditor.Element = function (type, data, htmlId, htmlClass, htmlStyle, isTemplated, rule) {
        if (!type)
            throw new Error("Parameter 'type' is required.");

        this.type = type;
        this.data = data;
        this.htmlId = htmlId;
        this.htmlClass = htmlClass;
        this.htmlStyle = htmlStyle;
        this.isTemplated = isTemplated;
        this.rule = rule;

        this.editor = null;
        this.parent = null;
        this.setIsFocusedEventHandlers = [];

        this.setEditor = function (editor) {
            this.editor = editor;
            if (!!this.children && _.isArray(this.children)) {
                _(this.children).each(function (child) {
                    child.setEditor(editor);
                });
            }
        };

        this.setParent = function(parentElement) {
            this.parent = parentElement;
            this.parent.onChildAdded(this);

            var currentAncestor = parentElement;
            while (!!currentAncestor) {
                currentAncestor.onDescendantAdded(this, parentElement);
                currentAncestor = currentAncestor.parent;
            }
        };

        this.setIsTemplated = function (value) {
            this.isTemplated = value;
            if (!!this.children && _.isArray(this.children)) {
                _(this.children).each(function (child) {
                    child.setIsTemplated(value);
                });
            }
        };

        this.applyElementEditorModel = function() { /* Virtual */ };

        this.getIsActive = function () {
            if (!this.editor)
                return false;
            return this.editor.activeElement === this && !this.getIsFocused();
        };

        this.setIsActive = function (value) {
            if (!this.editor)
                return;
            if (this.editor.isDragging || this.editor.isResizing)
                return;

            if (value)
                this.editor.activeElement = this;
            else
                this.editor.activeElement = this.parent;
        };

        this.getIsFocused = function () {
            if (!this.editor)
                return false;
            return this.editor.focusedElement === this;
        };

        this.setIsFocused = function () {
            if (!this.editor)
                return;
            if (!this.children && this.isTemplated)
                return;
            if (this.editor.isDragging || this.editor.isResizing)
                return;

            this.editor.focusedElement = this;
            _(this.setIsFocusedEventHandlers).each(function (item) {
                try {
                    item();
                }
                catch (ex) {
                    // Ignore.
                }
            });
        };

        this.getIsSelected = function () {
            if (this.getIsFocused())
                return true;

            if (!!this.children && _.isArray(this.children)) {
                return _(this.children).any(function(child) {
                    return child.getIsSelected();
                });
            }

            return false;
        };

        this.getIsDropTarget = function () {
            if (!this.editor)
                return false;
            return this.editor.dropTargetElement === this;
        }

        this.setIsDropTarget = function (value) {
            if (!this.editor)
                return;
            if (value)
                this.editor.dropTargetElement = this;
            else
                this.editor.dropTargetElement = null;
        };

        this.canDelete = function () {
            if (this.isTemplated || !this.parent)
                return false;
            return true;
        };

        this.delete = function () {
            if (!this.canDelete())
                return;
                this.parent.deleteChild(this);
        };

        this.canMoveUp = function () {
            if (this.isTemplated || !this.parent)
                return false;
            return this.parent.canMoveChildUp(this);
        };

        this.moveUp = function () {
            if (!this.canMoveUp())
                return;
                this.parent.moveChildUp(this);
        };

        this.canMoveDown = function () {
            if (this.isTemplated || !this.parent)
                return false;
            return this.parent.canMoveChildDown(this);
        };

        this.moveDown = function () {
            if (!this.canMoveDown())
                return;
                this.parent.moveChildDown(this);
        };

        this.elementToObject = function () {
            return {
                type: this.type,
                data: this.data,
                htmlId: this.htmlId,
                htmlClass: this.htmlClass,
                htmlStyle: this.htmlStyle,
                isTemplated: this.isTemplated,
                rule: this.rule
            };
        };

        this.getEditorObject = function() {
            return {};
        };

        this.copy = function (clipboardData) {
            var text = this.getInnerText();
            clipboardData.setData("text/plain", text);

            var data = this.toObject();
            var json = JSON.stringify(data, null, "\t");
            clipboardData.setData("text/json", json);
        };

        this.cut = function (clipboardData) {
            if (this.canDelete()) {
            this.copy(clipboardData);
            this.delete();
            }
        };

        this.paste = function (clipboardData) {
            if (!!this.parent)
                this.parent.paste(clipboardData);
        };
    };

})(LayoutEditor || (LayoutEditor = {}));
var LayoutEditor;
(function (LayoutEditor) {

    LayoutEditor.Container = function (allowedChildTypes, children) {

        this.allowedChildTypes = allowedChildTypes;
        this.children = children;
        this.isContainer = true;

        var self = this;

        this.onChildAdded = function (element) { /* Virtual */ };
        this.onDescendantAdded = function (element, parentElement) { /* Virtual */ };

        this.setChildren = function (children) {
            this.children = children;
            _(this.children).each(function (child) {
                child.setParent(self);
            });
        };

        this.setChildren(children);

        this.getIsSealed = function () {
            return _(this.children).any(function (child) {
                return child.isTemplated;
            });
        };

        var _baseSetIsFocused = this.setIsFocused;
        this.setIsFocused = function () {
            if (this.getIsSealed())
                return;
            _baseSetIsFocused.call(this);
        };

        this.addChild = function (child) {
            if (!_(this.children).contains(child) && (_(this.allowedChildTypes).contains(child.type) || child.isContainable))
                this.children.push(child);
            child.setEditor(this.editor);
            child.setIsTemplated(false);
            child.setParent(this);
        };

        this.deleteChild = function (child) {
            var index = _(this.children).indexOf(child);
            if (index >= 0) {
                this.children.splice(index, 1);
                this.editor.recycleBin.add(child);
                if (child.getIsActive())
                    this.editor.activeElement = null;
                if (child.getIsFocused()) {
                    // If the deleted child was focused, try to set new focus to the most appropriate sibling or parent.
                    if (this.children.length > index)
                        this.children[index].setIsFocused();
                    else if (index > 0)
                        this.children[index - 1].setIsFocused();
                    else
                        this.setIsFocused();
                }
            }
        };

        this.moveFocusPrevChild = function (child) {
            if (this.children.length < 2)
                return;
            var index = _(this.children).indexOf(child);
            if (index > 0)
                this.children[index - 1].setIsFocused();
        };

        this.moveFocusNextChild = function (child) {
            if (this.children.length < 2)
                return;
            var index = _(this.children).indexOf(child);
            if (index < this.children.length - 1)
                this.children[index + 1].setIsFocused();
        };

        this.insertChild = function (child, afterChild) {
            if (!_(this.children).contains(child)) {
                var index = Math.max(_(this.children).indexOf(afterChild), 0);
                this.children.splice(index + 1, 0, child);
                child.setEditor(this.editor);
                child.parent = this;
            }
        };

        this.moveChildUp = function (child) {
            if (!this.canMoveChildUp(child))
                return;
            var index = _(this.children).indexOf(child);
            this.children.move(index, index - 1);
        };

        this.moveChildDown = function (child) {
            if (!this.canMoveChildDown(child))
                return;
            var index = _(this.children).indexOf(child);
            this.children.move(index, index + 1);
        };

        this.canMoveChildUp = function (child) {
            var index = _(this.children).indexOf(child);
            return index > 0;
        };

        this.canMoveChildDown = function (child) {
            var index = _(this.children).indexOf(child);
            return index < this.children.length - 1;
        };

        this.childrenToObject = function () {
            return _(this.children).map(function (child) {
                return child.toObject();
            });
        };

        this.getInnerText = function () {
            return _(this.children).reduce(function (memo, child) {
                return memo + "\n" + child.getInnerText();
            }, "");
        }

        this.paste = function (clipboardData) {
            var json = clipboardData.getData("text/json");
            if (!!json) {
                var data = JSON.parse(json);
                var child = LayoutEditor.elementFrom(data);
                this.pasteChild(child);
            }
        };

        this.pasteChild = function (child) {
            if (_(this.allowedChildTypes).contains(child.type) || child.isContainable) {
                this.addChild(child);
                child.setIsFocused();
            }
            else if (!!this.parent)
                this.parent.pasteChild(child);
        }
    };

})(LayoutEditor || (LayoutEditor = {}));
var LayoutEditor;
(function (LayoutEditor) {

    LayoutEditor.Canvas = function (data, htmlId, htmlClass, htmlStyle, isTemplated, rule, children) {
        LayoutEditor.Element.call(this, "Canvas", data, htmlId, htmlClass, htmlStyle, isTemplated, rule);
        LayoutEditor.Container.call(this, ["Canvas", "Grid", "Content"], children);

        this.isContainable = true;

        this.toObject = function () {
            var result = this.elementToObject();
            result.children = this.childrenToObject();
            return result;
        };
        };

    LayoutEditor.Canvas.from = function (value) {
        var result = new LayoutEditor.Canvas(
            value.data,
            value.htmlId,
            value.htmlClass,
            value.htmlStyle,
            value.isTemplated,
            value.rule,
            LayoutEditor.childrenFrom(value.children));

        result.toolboxIcon = value.toolboxIcon;
        result.toolboxLabel = value.toolboxLabel;
        result.toolboxDescription = value.toolboxDescription;

        return result;
    };

})(LayoutEditor || (LayoutEditor = {}));

var LayoutEditor;
(function (LayoutEditor) {

    LayoutEditor.Grid = function (data, htmlId, htmlClass, htmlStyle, isTemplated, rule, children) {
        LayoutEditor.Element.call(this, "Grid", data, htmlId, htmlClass, htmlStyle, isTemplated, rule);
        LayoutEditor.Container.call(this, ["Row"], children);

        this.toObject = function () {
            var result = this.elementToObject();
            result.children = this.childrenToObject();
            return result;
        };
    };

    LayoutEditor.Grid.from = function (value) {
        var result = new LayoutEditor.Grid(
            value.data,
            value.htmlId,
            value.htmlClass,
            value.htmlStyle,
            value.isTemplated,
            value.rule,
            LayoutEditor.childrenFrom(value.children));
        result.toolboxIcon = value.toolboxIcon;
        result.toolboxLabel = value.toolboxLabel;
        result.toolboxDescription = value.toolboxDescription;
        return result;
    };

})(LayoutEditor || (LayoutEditor = {}));
var LayoutEditor;
(function (LayoutEditor) {

    LayoutEditor.Row = function (data, htmlId, htmlClass, htmlStyle, isTemplated, rule, children) {
        LayoutEditor.Element.call(this, "Row", data, htmlId, htmlClass, htmlStyle, isTemplated, rule);
        LayoutEditor.Container.call(this, ["Column"], children);

        var _self = this;

        function _getTotalColumnsWidth() {
            return _(_self.children).reduce(function (memo, child) {
                return memo + child.offset + child.width;
            }, 0);
        }

        // Implements a simple algorithm to distribute space (either positive or negative)
        // between the child columns of the row. Negative space is distributed when making
        // room for a new column (e.c. clipboard paste or dropping from the toolbox) while
        // positive space is distributed when filling the grap of a removed column.
        function _distributeSpace(space) {
            if (space == 0)
                return true;
             
            var undistributedSpace = space;

            if (undistributedSpace < 0) {
                var vacantSpace = 12 - _getTotalColumnsWidth();
                undistributedSpace += vacantSpace;
                if (undistributedSpace > 0)
                    undistributedSpace = 0;
            }

            // If space is negative, try to decrease offsets first.
            while (undistributedSpace < 0 && _(_self.children).any(function (column) { return column.offset > 0; })) { // While there is still offset left to remove.
                for (i = 0; i < _self.children.length && undistributedSpace < 0; i++) {
                    var column = _self.children[i];
                    if (column.offset > 0) {
                        column.offset--;
                        undistributedSpace++;
                    }
                }
            }

            function hasWidth(column) {
                if (undistributedSpace > 0)
                    return column.width < 12;
                else if (undistributedSpace < 0)
                    return column.width > 1;
                return false;
            }

            // Try to distribute remaining space (could be negative or positive) using widths.
            while (undistributedSpace != 0) {
                // Any more column width available for distribution?
                if (!_(_self.children).any(hasWidth))
                    break;
                for (i = 0; i < _self.children.length && undistributedSpace != 0; i++) {
                    var column = _self.children[i % _self.children.length];
                    if (hasWidth(column)) {
                        var delta = undistributedSpace / Math.abs(undistributedSpace);
                        column.width += delta;
                        undistributedSpace -= delta;
                    }
                }                
            }

            return undistributedSpace == 0;
        }

        var _isAddingColumn = false;

        this.canAddColumn = function () {
            return this.children.length < 12;
        };

        this.beginAddColumn = function (newColumnWidth) {
            if (!!_isAddingColumn)
                throw new Error("Column add operation is already in progress.")
            _(this.children).each(function (column) {
                column.beginChange();
            });
            if (_distributeSpace(-newColumnWidth)) {
                _isAddingColumn = true;
                return true;
            }
            _(this.children).each(function (column) {
                column.rollbackChange();
            });
            return false;
        };

        this.commitAddColumn = function () {
            if (!_isAddingColumn)
                throw new Error("No column add operation in progress.")
            _(this.children).each(function (column) {
                column.commitChange();
            });
            _isAddingColumn = false;
        };

        this.rollbackAddColumn = function () {
            if (!_isAddingColumn)
                throw new Error("No column add operation in progress.")
            _(this.children).each(function (column) {
                column.rollbackChange();
            });
            _isAddingColumn = false;
        };

        var _baseDeleteChild = this.deleteChild;
        this.deleteChild = function (column) { 
            var width = column.width;
            _baseDeleteChild.call(this, column);
            _distributeSpace(width);
        };

        this.canContractColumnRight = function (column, connectAdjacent) {
            var index = _(this.children).indexOf(column);
            if (index >= 0)
                return column.width > 1;
            return false;
        };

        this.contractColumnRight = function (column, connectAdjacent) {
            if (!this.canContractColumnRight(column, connectAdjacent))
                return;

            var index = _(this.children).indexOf(column);
            if (index >= 0) {
                if (column.width > 1) {
                    column.width--;
                    if (this.children.length > index + 1) {
                        var nextColumn = this.children[index + 1];
                        if (connectAdjacent && nextColumn.offset == 0)
                            nextColumn.width++;
                        else
                            nextColumn.offset++;
                    }
                }
            }
        };

        this.canExpandColumnRight = function (column, connectAdjacent) {
            var index = _(this.children).indexOf(column);
            if (index >= 0) {
                if (column.width >= 12)
                    return false;
                if (this.children.length > index + 1) {
                    var nextColumn = this.children[index + 1];
                    if (connectAdjacent && nextColumn.offset == 0)
                        return nextColumn.width > 1;
                    else
                        return nextColumn.offset > 0;
                }
                return _getTotalColumnsWidth() < 12;
            }
            return false;
        };

        this.expandColumnRight = function (column, connectAdjacent) {
            if (!this.canExpandColumnRight(column, connectAdjacent))
                return;

            var index = _(this.children).indexOf(column);
            if (index >= 0) {
                if (this.children.length > index + 1) {
                    var nextColumn = this.children[index + 1];
                    if (connectAdjacent && nextColumn.offset == 0)
                        nextColumn.width--;
                    else
                        nextColumn.offset--;
                }
                column.width++;
            }
        };

        this.canExpandColumnLeft = function (column, connectAdjacent) {
            var index = _(this.children).indexOf(column);
            if (index >= 0) {
                if (column.width >= 12)
                    return false;
                if (index > 0) {
                    var prevColumn = this.children[index - 1];
                    if (connectAdjacent && column.offset == 0)
                        return prevColumn.width > 1;
                }
                return column.offset > 0;
            }
            return false;
        };

        this.expandColumnLeft = function (column, connectAdjacent) {
            if (!this.canExpandColumnLeft(column, connectAdjacent))
                return;

            var index = _(this.children).indexOf(column);
            if (index >= 0) {
                if (index > 0) {
                    var prevColumn = this.children[index - 1];
                    if (connectAdjacent && column.offset == 0)
                        prevColumn.width--;
                    else
                        column.offset--;
                }
                else
                    column.offset--;
                column.width++;
            }
        };

        this.canContractColumnLeft = function (column, connectAdjacent) {
            var index = _(this.children).indexOf(column);
            if (index >= 0)
                return column.width > 1;
            return false;
        };

        this.contractColumnLeft = function (column, connectAdjacent) {
            if (!this.canContractColumnLeft(column, connectAdjacent))
                return;

            var index = _(this.children).indexOf(column);
            if (index >= 0) {
                if (index > 0) {
                    var prevColumn = this.children[index - 1];
                    if (connectAdjacent && column.offset == 0)
                        prevColumn.width++;
                    else
                        column.offset++;
                }
                else
                    column.offset++;
                column.width--;
            }
        };

        this.evenColumns = function () {
            if (this.children.length == 0)
                return;

            var evenWidth = Math.floor(12 / this.children.length);
            _(this.children).each(function (column) {
                column.width = evenWidth;
                column.offset = 0;
            });

            var rest = 12 % this.children.length;
            if (rest > 0)
                _distributeSpace(rest);
        };

        var _basePasteChild = this.pasteChild;
        this.pasteChild = function (child) {
            if (child.type == "Column") {
                if (this.beginAddColumn(child.width)) {
                    this.commitAddColumn();
                    _basePasteChild.call(this, child)
                }
            }
            else if (!!this.parent)
                this.parent.pasteChild(child);
        }

        this.toObject = function () {
            var result = this.elementToObject();
            result.children = this.childrenToObject();
            return result;
        };
    };

    LayoutEditor.Row.from = function (value) {
        var result = new LayoutEditor.Row(
            value.data,
            value.htmlId,
            value.htmlClass,
            value.htmlStyle,
            value.isTemplated,
            value.rule,
            LayoutEditor.childrenFrom(value.children));
        result.toolboxIcon = value.toolboxIcon;
        result.toolboxLabel = value.toolboxLabel;
        result.toolboxDescription = value.toolboxDescription;
        return result;
    };

})(LayoutEditor || (LayoutEditor = {}));
var LayoutEditor;
(function (LayoutEditor) {
    LayoutEditor.Column = function (data, htmlId, htmlClass, htmlStyle, isTemplated, width, offset, collapsible, rule, children) {
        LayoutEditor.Element.call(this, "Column", data, htmlId, htmlClass, htmlStyle, isTemplated, rule);
        LayoutEditor.Container.call(this, ["Grid", "Content"], children);

        this.width = width;
        this.offset = offset;
        this.collapsible = collapsible;

        var _hasPendingChange = false;
        var _origWidth = 0;
        var _origOffset = 0;

        this.beginChange = function () {
            if (!!_hasPendingChange)
                throw new Error("Column already has a pending change.");
            _hasPendingChange = true;
            _origWidth = this.width;
            _origOffset = this.offset;
        };

        this.commitChange = function () {
            if (!_hasPendingChange)
                throw new Error("Column has no pending change.");
            _origWidth = 0;
            _origOffset = 0;
            _hasPendingChange = false;
        };

        this.rollbackChange = function () {
            if (!_hasPendingChange)
                throw new Error("Column has no pending change.");
            this.width = _origWidth;
            this.offset = _origOffset;
            _origWidth = 0;
            _origOffset = 0;
            _hasPendingChange = false;
        };

        this.canSplit = function () {
            if (this.isTemplated)
                return false;
            return this.width > 1;
        };

        this.split = function () {
            if (!this.canSplit())
                return;

            var newColumnWidth = Math.floor(this.width / 2);
            var newColumn = LayoutEditor.Column.from({
                data: null,
                htmlId: null,
                htmlClass: null,
                htmlStyle: null,
                width: newColumnWidth,
                offset: 0,
                children: []
            });

            this.width = this.width - newColumnWidth;
            this.parent.insertChild(newColumn, this);
            newColumn.setIsFocused();
        };

        this.canContractRight = function (connectAdjacent) {
            if (this.isTemplated)
                return false;
            return this.parent.canContractColumnRight(this, connectAdjacent);
        };

        this.contractRight = function (connectAdjacent) {
            if (!this.canContractRight(connectAdjacent))
                return;
            this.parent.contractColumnRight(this, connectAdjacent);
        };

        this.canExpandRight = function (connectAdjacent) {
            if (this.isTemplated)
                return false;
            return this.parent.canExpandColumnRight(this, connectAdjacent);
        };

        this.expandRight = function (connectAdjacent) {
            if (!this.canExpandRight(connectAdjacent))
                return;
            this.parent.expandColumnRight(this, connectAdjacent);
        };

        this.canExpandLeft = function (connectAdjacent) {
            if (this.isTemplated)
                return false;
            return this.parent.canExpandColumnLeft(this, connectAdjacent);
        };

        this.expandLeft = function (connectAdjacent) {
            if (!this.canExpandLeft(connectAdjacent))
                return;
            this.parent.expandColumnLeft(this, connectAdjacent);
        };

        this.canContractLeft = function (connectAdjacent) {
            if (this.isTemplated)
                return false;
            return this.parent.canContractColumnLeft(this, connectAdjacent);
        };

        this.contractLeft = function (connectAdjacent) {
            if (!this.canContractLeft(connectAdjacent))
                return;
            this.parent.contractColumnLeft(this, connectAdjacent);
        };

        this.toObject = function () {
            var result = this.elementToObject();
            result.width = this.width;
            result.offset = this.offset;
            result.collapsible = this.collapsible;
            result.children = this.childrenToObject();
            return result;
        };
    };

    LayoutEditor.Column.from = function (value) {
        var result = new LayoutEditor.Column(
            value.data,
            value.htmlId,
            value.htmlClass,
            value.htmlStyle,
            value.isTemplated,
            value.width,
            value.offset,
            value.collapsible,
            value.rule,
            LayoutEditor.childrenFrom(value.children));
        result.toolboxIcon = value.toolboxIcon;
        result.toolboxLabel = value.toolboxLabel;
        result.toolboxDescription = value.toolboxDescription;
        return result;
    };

    LayoutEditor.Column.times = function (value) {
        return _.times(value, function (n) {
            return LayoutEditor.Column.from({
                data: null,
                htmlId: null,
                htmlClass: null,
                isTemplated: false,
                width: 12 / value,
                offset: 0,
                collapsible: null,
                children: []
            });
        });
    };
})(LayoutEditor || (LayoutEditor = {}));
var LayoutEditor;
(function (LayoutEditor) {

    LayoutEditor.Content = function (data, htmlId, htmlClass, htmlStyle, isTemplated, contentType, contentTypeLabel, contentTypeClass, html, hasEditor, rule) {
        LayoutEditor.Element.call(this, "Content", data, htmlId, htmlClass, htmlStyle, isTemplated, rule);

        this.contentType = contentType;
        this.contentTypeLabel = contentTypeLabel;
        this.contentTypeClass = contentTypeClass;
        this.html = html;
        this.hasEditor = hasEditor;

        this.getInnerText = function () {
            return $($.parseHTML("<div>" + this.html + "</div>")).text();
        };

        // This function will be overwritten by the Content directive.
        this.setHtml = function (html) {
            this.html = html;
            this.htmlUnsafe = html;
        }

        this.toObject = function () {
            return {
                "type": "Content"
            };
        };

        this.toObject = function () {
            var result = this.elementToObject();
            result.contentType = this.contentType;
            result.contentTypeLabel = this.contentTypeLabel;
            result.contentTypeClass = this.contentTypeClass;
            result.html = this.html;
            result.hasEditor = hasEditor;
            return result;
        };

        this.setHtml(html);
    };

    LayoutEditor.Content.from = function (value) {
        var result = new LayoutEditor.Content(
            value.data,
            value.htmlId,
            value.htmlClass,
            value.htmlStyle,
            value.isTemplated,
            value.contentType,
            value.contentTypeLabel,
            value.contentTypeClass,
            value.html,
            value.hasEditor,
            value.rule);

        return result;
    };

})(LayoutEditor || (LayoutEditor = {}));
var LayoutEditor;
(function ($, LayoutEditor) {

    LayoutEditor.Html = function (data, htmlId, htmlClass, htmlStyle, isTemplated, contentType, contentTypeLabel, contentTypeClass, html, hasEditor, rule) {
        LayoutEditor.Element.call(this, "Html", data, htmlId, htmlClass, htmlStyle, isTemplated, rule);

        this.contentType = contentType;
        this.contentTypeLabel = contentTypeLabel;
        this.contentTypeClass = contentTypeClass;
        this.html = html;
        this.hasEditor = hasEditor;
        this.isContainable = true;

        this.getInnerText = function () {
            return $($.parseHTML("<div>" + this.html + "</div>")).text();
        };

        // This function will be overwritten by the Content directive.
        this.setHtml = function (html) {
            this.html = html;
            this.htmlUnsafe = html;
        }

        this.toObject = function () {
            return {
                "type": "Html"
            };
        };

        this.toObject = function () {
            var result = this.elementToObject();
            result.contentType = this.contentType;
            result.contentTypeLabel = this.contentTypeLabel;
            result.contentTypeClass = this.contentTypeClass;
            result.html = this.html;
            result.hasEditor = hasEditor;
            return result;
        };

        var getEditorObject = this.getEditorObject;
        this.getEditorObject = function () {
            var dto = getEditorObject();
            return $.extend(dto, {
                Content: this.html
            });
        }

        this.setHtml(html);
    };

    LayoutEditor.Html.from = function (value) {
        var result = new LayoutEditor.Html(
            value.data,
            value.htmlId,
            value.htmlClass,
            value.htmlStyle,
            value.isTemplated,
            value.contentType,
            value.contentTypeLabel,
            value.contentTypeClass,
            value.html,
            value.hasEditor,
            value.rule);

        return result;
    };

    LayoutEditor.registerFactory("Html", function(value) { return LayoutEditor.Html.from(value); });

})(jQuery, LayoutEditor || (LayoutEditor = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkhlbHBlcnMuanMiLCJFZGl0b3IuanMiLCJFbGVtZW50LmpzIiwiQ29udGFpbmVyLmpzIiwiQ2FudmFzLmpzIiwiR3JpZC5qcyIsIlJvdy5qcyIsIkNvbHVtbi5qcyIsIkNvbnRlbnQuanMiLCJIdG1sLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzlJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzVKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Ik1vZGVscy5qcyIsInNvdXJjZXNDb250ZW50IjpbInZhciBMYXlvdXRFZGl0b3I7XHJcbihmdW5jdGlvbiAoTGF5b3V0RWRpdG9yKSB7XHJcblxyXG4gICAgQXJyYXkucHJvdG90eXBlLm1vdmUgPSBmdW5jdGlvbiAoZnJvbSwgdG8pIHtcclxuICAgICAgICB0aGlzLnNwbGljZSh0bywgMCwgdGhpcy5zcGxpY2UoZnJvbSwgMSlbMF0pO1xyXG4gICAgfTtcclxuXHJcbiAgICBMYXlvdXRFZGl0b3IuY2hpbGRyZW5Gcm9tID0gZnVuY3Rpb24odmFsdWVzKSB7XHJcbiAgICAgICAgcmV0dXJuIF8odmFsdWVzKS5tYXAoZnVuY3Rpb24odmFsdWUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIExheW91dEVkaXRvci5lbGVtZW50RnJvbSh2YWx1ZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciByZWdpc3RlckZhY3RvcnkgPSBMYXlvdXRFZGl0b3IucmVnaXN0ZXJGYWN0b3J5ID0gZnVuY3Rpb24odHlwZSwgZmFjdG9yeSkge1xyXG4gICAgICAgIHZhciBmYWN0b3JpZXMgPSBMYXlvdXRFZGl0b3IuZmFjdG9yaWVzID0gTGF5b3V0RWRpdG9yLmZhY3RvcmllcyB8fCB7fTtcclxuICAgICAgICBmYWN0b3JpZXNbdHlwZV0gPSBmYWN0b3J5O1xyXG4gICAgfTtcclxuXHJcbiAgICByZWdpc3RlckZhY3RvcnkoXCJDYW52YXNcIiwgZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiBMYXlvdXRFZGl0b3IuQ2FudmFzLmZyb20odmFsdWUpOyB9KTtcclxuICAgIHJlZ2lzdGVyRmFjdG9yeShcIkdyaWRcIiwgZnVuY3Rpb24odmFsdWUpIHsgcmV0dXJuIExheW91dEVkaXRvci5HcmlkLmZyb20odmFsdWUpOyB9KTtcclxuICAgIHJlZ2lzdGVyRmFjdG9yeShcIlJvd1wiLCBmdW5jdGlvbih2YWx1ZSkgeyByZXR1cm4gTGF5b3V0RWRpdG9yLlJvdy5mcm9tKHZhbHVlKTsgfSk7XHJcbiAgICByZWdpc3RlckZhY3RvcnkoXCJDb2x1bW5cIiwgZnVuY3Rpb24odmFsdWUpIHsgcmV0dXJuIExheW91dEVkaXRvci5Db2x1bW4uZnJvbSh2YWx1ZSk7IH0pO1xyXG4gICAgcmVnaXN0ZXJGYWN0b3J5KFwiQ29udGVudFwiLCBmdW5jdGlvbih2YWx1ZSkgeyByZXR1cm4gTGF5b3V0RWRpdG9yLkNvbnRlbnQuZnJvbSh2YWx1ZSk7IH0pO1xyXG5cclxuICAgIExheW91dEVkaXRvci5lbGVtZW50RnJvbSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHZhciBmYWN0b3J5ID0gTGF5b3V0RWRpdG9yLmZhY3Rvcmllc1t2YWx1ZS50eXBlXTtcclxuXHJcbiAgICAgICAgaWYgKCFmYWN0b3J5KVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBlbGVtZW50IHdpdGggdHlwZSBcXFwiXCIgKyB2YWx1ZS50eXBlICsgXCJcXFwiIHdhcyBmb3VuZC5cIik7XHJcblxyXG4gICAgICAgIHZhciBlbGVtZW50ID0gZmFjdG9yeSh2YWx1ZSk7XHJcbiAgICAgICAgcmV0dXJuIGVsZW1lbnQ7XHJcbiAgICB9O1xyXG5cclxuICAgIExheW91dEVkaXRvci5zZXRNb2RlbCA9IGZ1bmN0aW9uIChlbGVtZW50U2VsZWN0b3IsIG1vZGVsKSB7XHJcbiAgICAgICAgJChlbGVtZW50U2VsZWN0b3IpLnNjb3BlKCkuZWxlbWVudCA9IG1vZGVsO1xyXG4gICAgfTtcclxuXHJcbiAgICBMYXlvdXRFZGl0b3IuZ2V0TW9kZWwgPSBmdW5jdGlvbiAoZWxlbWVudFNlbGVjdG9yKSB7XHJcbiAgICAgICAgcmV0dXJuICQoZWxlbWVudFNlbGVjdG9yKS5zY29wZSgpLmVsZW1lbnQ7XHJcbiAgICB9O1xyXG5cclxufSkoTGF5b3V0RWRpdG9yIHx8IChMYXlvdXRFZGl0b3IgPSB7fSkpOyIsInZhciBMYXlvdXRFZGl0b3I7XHJcbihmdW5jdGlvbiAoTGF5b3V0RWRpdG9yKSB7XHJcblxyXG4gICAgTGF5b3V0RWRpdG9yLkVkaXRvciA9IGZ1bmN0aW9uIChjb25maWcsIGNhbnZhc0RhdGEpIHtcclxuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcclxuICAgICAgICB0aGlzLmNhbnZhcyA9IExheW91dEVkaXRvci5DYW52YXMuZnJvbShjYW52YXNEYXRhKTtcclxuICAgICAgICB0aGlzLmluaXRpYWxTdGF0ZSA9IEpTT04uc3RyaW5naWZ5KHRoaXMuY2FudmFzLnRvT2JqZWN0KCkpO1xyXG4gICAgICAgIHRoaXMuYWN0aXZlRWxlbWVudCA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5mb2N1c2VkRWxlbWVudCA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5kcm9wVGFyZ2V0RWxlbWVudCA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5pc0RyYWdnaW5nID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5pc1Jlc2l6aW5nID0gZmFsc2U7XHJcblxyXG4gICAgICAgIHRoaXMucmVzZXRUb29sYm94RWxlbWVudHMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHRoaXMudG9vbGJveEVsZW1lbnRzID0gW1xyXG4gICAgICAgICAgICAgICAgTGF5b3V0RWRpdG9yLlJvdy5mcm9tKHtcclxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW11cclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIF07XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5pc0RpcnR5ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHZhciBjdXJyZW50U3RhdGUgPSBKU09OLnN0cmluZ2lmeSh0aGlzLmNhbnZhcy50b09iamVjdCgpKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW5pdGlhbFN0YXRlICE9IGN1cnJlbnRTdGF0ZTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLnJlc2V0VG9vbGJveEVsZW1lbnRzKCk7XHJcbiAgICAgICAgdGhpcy5jYW52YXMuc2V0RWRpdG9yKHRoaXMpO1xyXG4gICAgfTtcclxuXHJcbn0pKExheW91dEVkaXRvciB8fCAoTGF5b3V0RWRpdG9yID0ge30pKTtcclxuIiwidmFyIExheW91dEVkaXRvcjtcclxuKGZ1bmN0aW9uIChMYXlvdXRFZGl0b3IpIHtcclxuXHJcbiAgICBMYXlvdXRFZGl0b3IuRWxlbWVudCA9IGZ1bmN0aW9uICh0eXBlLCBkYXRhLCBodG1sSWQsIGh0bWxDbGFzcywgaHRtbFN0eWxlLCBpc1RlbXBsYXRlZCwgcnVsZSkge1xyXG4gICAgICAgIGlmICghdHlwZSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUGFyYW1ldGVyICd0eXBlJyBpcyByZXF1aXJlZC5cIik7XHJcblxyXG4gICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XHJcbiAgICAgICAgdGhpcy5kYXRhID0gZGF0YTtcclxuICAgICAgICB0aGlzLmh0bWxJZCA9IGh0bWxJZDtcclxuICAgICAgICB0aGlzLmh0bWxDbGFzcyA9IGh0bWxDbGFzcztcclxuICAgICAgICB0aGlzLmh0bWxTdHlsZSA9IGh0bWxTdHlsZTtcclxuICAgICAgICB0aGlzLmlzVGVtcGxhdGVkID0gaXNUZW1wbGF0ZWQ7XHJcbiAgICAgICAgdGhpcy5ydWxlID0gcnVsZTtcclxuXHJcbiAgICAgICAgdGhpcy5lZGl0b3IgPSBudWxsO1xyXG4gICAgICAgIHRoaXMucGFyZW50ID0gbnVsbDtcclxuICAgICAgICB0aGlzLnNldElzRm9jdXNlZEV2ZW50SGFuZGxlcnMgPSBbXTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXRFZGl0b3IgPSBmdW5jdGlvbiAoZWRpdG9yKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZWRpdG9yID0gZWRpdG9yO1xyXG4gICAgICAgICAgICBpZiAoISF0aGlzLmNoaWxkcmVuICYmIF8uaXNBcnJheSh0aGlzLmNoaWxkcmVuKSkge1xyXG4gICAgICAgICAgICAgICAgXyh0aGlzLmNoaWxkcmVuKS5lYWNoKGZ1bmN0aW9uIChjaGlsZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkLnNldEVkaXRvcihlZGl0b3IpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLnNldFBhcmVudCA9IGZ1bmN0aW9uKHBhcmVudEVsZW1lbnQpIHtcclxuICAgICAgICAgICAgdGhpcy5wYXJlbnQgPSBwYXJlbnRFbGVtZW50O1xyXG4gICAgICAgICAgICB0aGlzLnBhcmVudC5vbkNoaWxkQWRkZWQodGhpcyk7XHJcblxyXG4gICAgICAgICAgICB2YXIgY3VycmVudEFuY2VzdG9yID0gcGFyZW50RWxlbWVudDtcclxuICAgICAgICAgICAgd2hpbGUgKCEhY3VycmVudEFuY2VzdG9yKSB7XHJcbiAgICAgICAgICAgICAgICBjdXJyZW50QW5jZXN0b3Iub25EZXNjZW5kYW50QWRkZWQodGhpcywgcGFyZW50RWxlbWVudCk7XHJcbiAgICAgICAgICAgICAgICBjdXJyZW50QW5jZXN0b3IgPSBjdXJyZW50QW5jZXN0b3IucGFyZW50O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXRJc1RlbXBsYXRlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgICAgICB0aGlzLmlzVGVtcGxhdGVkID0gdmFsdWU7XHJcbiAgICAgICAgICAgIGlmICghIXRoaXMuY2hpbGRyZW4gJiYgXy5pc0FycmF5KHRoaXMuY2hpbGRyZW4pKSB7XHJcbiAgICAgICAgICAgICAgICBfKHRoaXMuY2hpbGRyZW4pLmVhY2goZnVuY3Rpb24gKGNoaWxkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2hpbGQuc2V0SXNUZW1wbGF0ZWQodmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLmFwcGx5RWxlbWVudEVkaXRvck1vZGVsID0gZnVuY3Rpb24oKSB7IC8qIFZpcnR1YWwgKi8gfTtcclxuXHJcbiAgICAgICAgdGhpcy5nZXRJc0FjdGl2ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmVkaXRvcilcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZWRpdG9yLmFjdGl2ZUVsZW1lbnQgPT09IHRoaXMgJiYgIXRoaXMuZ2V0SXNGb2N1c2VkKCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXRJc0FjdGl2ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuZWRpdG9yKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5lZGl0b3IuaXNEcmFnZ2luZyB8fCB0aGlzLmVkaXRvci5pc1Jlc2l6aW5nKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgaWYgKHZhbHVlKVxyXG4gICAgICAgICAgICAgICAgdGhpcy5lZGl0b3IuYWN0aXZlRWxlbWVudCA9IHRoaXM7XHJcbiAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgIHRoaXMuZWRpdG9yLmFjdGl2ZUVsZW1lbnQgPSB0aGlzLnBhcmVudDtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLmdldElzRm9jdXNlZCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmVkaXRvcilcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZWRpdG9yLmZvY3VzZWRFbGVtZW50ID09PSB0aGlzO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuc2V0SXNGb2N1c2VkID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuZWRpdG9yKVxyXG4gICAgICAgICAgICBcdHJldHVybjtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmNoaWxkcmVuICYmIHRoaXMuaXNUZW1wbGF0ZWQpXHJcbiAgICAgICAgICAgIFx0cmV0dXJuO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5lZGl0b3IuaXNEcmFnZ2luZyB8fCB0aGlzLmVkaXRvci5pc1Jlc2l6aW5nKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5lZGl0b3IuZm9jdXNlZEVsZW1lbnQgPSB0aGlzO1xyXG4gICAgICAgICAgICBfKHRoaXMuc2V0SXNGb2N1c2VkRXZlbnRIYW5kbGVycykuZWFjaChmdW5jdGlvbiAoaXRlbSkge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICBpdGVtKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXRjaCAoZXgpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBJZ25vcmUuXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuZ2V0SXNTZWxlY3RlZCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuZ2V0SXNGb2N1c2VkKCkpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuXHJcbiAgICAgICAgICAgIGlmICghIXRoaXMuY2hpbGRyZW4gJiYgXy5pc0FycmF5KHRoaXMuY2hpbGRyZW4pKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXyh0aGlzLmNoaWxkcmVuKS5hbnkoZnVuY3Rpb24oY2hpbGQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2hpbGQuZ2V0SXNTZWxlY3RlZCgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLmdldElzRHJvcFRhcmdldCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmVkaXRvcilcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZWRpdG9yLmRyb3BUYXJnZXRFbGVtZW50ID09PSB0aGlzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5zZXRJc0Ryb3BUYXJnZXQgPSBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmVkaXRvcilcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgaWYgKHZhbHVlKVxyXG4gICAgICAgICAgICAgICAgdGhpcy5lZGl0b3IuZHJvcFRhcmdldEVsZW1lbnQgPSB0aGlzO1xyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICB0aGlzLmVkaXRvci5kcm9wVGFyZ2V0RWxlbWVudCA9IG51bGw7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jYW5EZWxldGUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmlzVGVtcGxhdGVkIHx8ICF0aGlzLnBhcmVudClcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5kZWxldGUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5jYW5EZWxldGUoKSlcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgdGhpcy5wYXJlbnQuZGVsZXRlQ2hpbGQodGhpcyk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jYW5Nb3ZlVXAgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmlzVGVtcGxhdGVkIHx8ICF0aGlzLnBhcmVudClcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyZW50LmNhbk1vdmVDaGlsZFVwKHRoaXMpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMubW92ZVVwID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuY2FuTW92ZVVwKCkpXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIHRoaXMucGFyZW50Lm1vdmVDaGlsZFVwKHRoaXMpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuY2FuTW92ZURvd24gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmlzVGVtcGxhdGVkIHx8ICF0aGlzLnBhcmVudClcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyZW50LmNhbk1vdmVDaGlsZERvd24odGhpcyk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5tb3ZlRG93biA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmNhbk1vdmVEb3duKCkpXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIHRoaXMucGFyZW50Lm1vdmVDaGlsZERvd24odGhpcyk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5lbGVtZW50VG9PYmplY3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiB0aGlzLnR5cGUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB0aGlzLmRhdGEsXHJcbiAgICAgICAgICAgICAgICBodG1sSWQ6IHRoaXMuaHRtbElkLFxyXG4gICAgICAgICAgICAgICAgaHRtbENsYXNzOiB0aGlzLmh0bWxDbGFzcyxcclxuICAgICAgICAgICAgICAgIGh0bWxTdHlsZTogdGhpcy5odG1sU3R5bGUsXHJcbiAgICAgICAgICAgICAgICBpc1RlbXBsYXRlZDogdGhpcy5pc1RlbXBsYXRlZCxcclxuICAgICAgICAgICAgICAgIHJ1bGU6IHRoaXMucnVsZVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuZ2V0RWRpdG9yT2JqZWN0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7fTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLmNvcHkgPSBmdW5jdGlvbiAoY2xpcGJvYXJkRGF0YSkge1xyXG4gICAgICAgICAgICB2YXIgdGV4dCA9IHRoaXMuZ2V0SW5uZXJUZXh0KCk7XHJcbiAgICAgICAgICAgIGNsaXBib2FyZERhdGEuc2V0RGF0YShcInRleHQvcGxhaW5cIiwgdGV4dCk7XHJcblxyXG4gICAgICAgICAgICB2YXIgZGF0YSA9IHRoaXMudG9PYmplY3QoKTtcclxuICAgICAgICAgICAgdmFyIGpzb24gPSBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCBcIlxcdFwiKTtcclxuICAgICAgICAgICAgY2xpcGJvYXJkRGF0YS5zZXREYXRhKFwidGV4dC9qc29uXCIsIGpzb24pO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuY3V0ID0gZnVuY3Rpb24gKGNsaXBib2FyZERhdGEpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuY2FuRGVsZXRlKCkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29weShjbGlwYm9hcmREYXRhKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZGVsZXRlKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLnBhc3RlID0gZnVuY3Rpb24gKGNsaXBib2FyZERhdGEpIHtcclxuICAgICAgICAgICAgaWYgKCEhdGhpcy5wYXJlbnQpXHJcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudC5wYXN0ZShjbGlwYm9hcmREYXRhKTtcclxuICAgICAgICB9O1xyXG4gICAgfTtcclxuXHJcbn0pKExheW91dEVkaXRvciB8fCAoTGF5b3V0RWRpdG9yID0ge30pKTsiLCJ2YXIgTGF5b3V0RWRpdG9yO1xyXG4oZnVuY3Rpb24gKExheW91dEVkaXRvcikge1xyXG5cclxuICAgIExheW91dEVkaXRvci5Db250YWluZXIgPSBmdW5jdGlvbiAoYWxsb3dlZENoaWxkVHlwZXMsIGNoaWxkcmVuKSB7XHJcblxyXG4gICAgICAgIHRoaXMuYWxsb3dlZENoaWxkVHlwZXMgPSBhbGxvd2VkQ2hpbGRUeXBlcztcclxuICAgICAgICB0aGlzLmNoaWxkcmVuID0gY2hpbGRyZW47XHJcbiAgICAgICAgdGhpcy5pc0NvbnRhaW5lciA9IHRydWU7XHJcblxyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICAgICAgdGhpcy5vbkNoaWxkQWRkZWQgPSBmdW5jdGlvbiAoZWxlbWVudCkgeyAvKiBWaXJ0dWFsICovIH07XHJcbiAgICAgICAgdGhpcy5vbkRlc2NlbmRhbnRBZGRlZCA9IGZ1bmN0aW9uIChlbGVtZW50LCBwYXJlbnRFbGVtZW50KSB7IC8qIFZpcnR1YWwgKi8gfTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXRDaGlsZHJlbiA9IGZ1bmN0aW9uIChjaGlsZHJlbikge1xyXG4gICAgICAgICAgICB0aGlzLmNoaWxkcmVuID0gY2hpbGRyZW47XHJcbiAgICAgICAgICAgIF8odGhpcy5jaGlsZHJlbikuZWFjaChmdW5jdGlvbiAoY2hpbGQpIHtcclxuICAgICAgICAgICAgICAgIGNoaWxkLnNldFBhcmVudChzZWxmKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXRDaGlsZHJlbihjaGlsZHJlbik7XHJcblxyXG4gICAgICAgIHRoaXMuZ2V0SXNTZWFsZWQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBfKHRoaXMuY2hpbGRyZW4pLmFueShmdW5jdGlvbiAoY2hpbGQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBjaGlsZC5pc1RlbXBsYXRlZDtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdmFyIF9iYXNlU2V0SXNGb2N1c2VkID0gdGhpcy5zZXRJc0ZvY3VzZWQ7XHJcbiAgICAgICAgdGhpcy5zZXRJc0ZvY3VzZWQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmdldElzU2VhbGVkKCkpXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIF9iYXNlU2V0SXNGb2N1c2VkLmNhbGwodGhpcyk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5hZGRDaGlsZCA9IGZ1bmN0aW9uIChjaGlsZCkge1xyXG4gICAgICAgICAgICBpZiAoIV8odGhpcy5jaGlsZHJlbikuY29udGFpbnMoY2hpbGQpICYmIChfKHRoaXMuYWxsb3dlZENoaWxkVHlwZXMpLmNvbnRhaW5zKGNoaWxkLnR5cGUpIHx8IGNoaWxkLmlzQ29udGFpbmFibGUpKVxyXG4gICAgICAgICAgICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKGNoaWxkKTtcclxuICAgICAgICAgICAgY2hpbGQuc2V0RWRpdG9yKHRoaXMuZWRpdG9yKTtcclxuICAgICAgICAgICAgY2hpbGQuc2V0SXNUZW1wbGF0ZWQoZmFsc2UpO1xyXG4gICAgICAgICAgICBjaGlsZC5zZXRQYXJlbnQodGhpcyk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5kZWxldGVDaGlsZCA9IGZ1bmN0aW9uIChjaGlsZCkge1xyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSBfKHRoaXMuY2hpbGRyZW4pLmluZGV4T2YoY2hpbGQpO1xyXG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoaW5kZXgsIDEpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkLmdldElzQWN0aXZlKCkpXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lZGl0b3IuYWN0aXZlRWxlbWVudCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGQuZ2V0SXNGb2N1c2VkKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGUgZGVsZXRlZCBjaGlsZCB3YXMgZm9jdXNlZCwgdHJ5IHRvIHNldCBuZXcgZm9jdXMgdG8gdGhlIG1vc3QgYXBwcm9wcmlhdGUgc2libGluZyBvciBwYXJlbnQuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY2hpbGRyZW4ubGVuZ3RoID4gaW5kZXgpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW5baW5kZXhdLnNldElzRm9jdXNlZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGluZGV4ID4gMClcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jaGlsZHJlbltpbmRleCAtIDFdLnNldElzRm9jdXNlZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRJc0ZvY3VzZWQoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMubW92ZUZvY3VzUHJldkNoaWxkID0gZnVuY3Rpb24gKGNoaWxkKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmNoaWxkcmVuLmxlbmd0aCA8IDIpXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IF8odGhpcy5jaGlsZHJlbikuaW5kZXhPZihjaGlsZCk7XHJcbiAgICAgICAgICAgIGlmIChpbmRleCA+IDApXHJcbiAgICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuW2luZGV4IC0gMV0uc2V0SXNGb2N1c2VkKCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5tb3ZlRm9jdXNOZXh0Q2hpbGQgPSBmdW5jdGlvbiAoY2hpbGQpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuY2hpbGRyZW4ubGVuZ3RoIDwgMilcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgdmFyIGluZGV4ID0gXyh0aGlzLmNoaWxkcmVuKS5pbmRleE9mKGNoaWxkKTtcclxuICAgICAgICAgICAgaWYgKGluZGV4IDwgdGhpcy5jaGlsZHJlbi5sZW5ndGggLSAxKVxyXG4gICAgICAgICAgICAgICAgdGhpcy5jaGlsZHJlbltpbmRleCArIDFdLnNldElzRm9jdXNlZCgpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuaW5zZXJ0Q2hpbGQgPSBmdW5jdGlvbiAoY2hpbGQsIGFmdGVyQ2hpbGQpIHtcclxuICAgICAgICAgICAgaWYgKCFfKHRoaXMuY2hpbGRyZW4pLmNvbnRhaW5zKGNoaWxkKSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gTWF0aC5tYXgoXyh0aGlzLmNoaWxkcmVuKS5pbmRleE9mKGFmdGVyQ2hpbGQpLCAwKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW4uc3BsaWNlKGluZGV4ICsgMSwgMCwgY2hpbGQpO1xyXG4gICAgICAgICAgICAgICAgY2hpbGQuc2V0RWRpdG9yKHRoaXMuZWRpdG9yKTtcclxuICAgICAgICAgICAgICAgIGNoaWxkLnBhcmVudCA9IHRoaXM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLm1vdmVDaGlsZFVwID0gZnVuY3Rpb24gKGNoaWxkKSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5jYW5Nb3ZlQ2hpbGRVcChjaGlsZCkpXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IF8odGhpcy5jaGlsZHJlbikuaW5kZXhPZihjaGlsZCk7XHJcbiAgICAgICAgICAgIHRoaXMuY2hpbGRyZW4ubW92ZShpbmRleCwgaW5kZXggLSAxKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLm1vdmVDaGlsZERvd24gPSBmdW5jdGlvbiAoY2hpbGQpIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmNhbk1vdmVDaGlsZERvd24oY2hpbGQpKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSBfKHRoaXMuY2hpbGRyZW4pLmluZGV4T2YoY2hpbGQpO1xyXG4gICAgICAgICAgICB0aGlzLmNoaWxkcmVuLm1vdmUoaW5kZXgsIGluZGV4ICsgMSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jYW5Nb3ZlQ2hpbGRVcCA9IGZ1bmN0aW9uIChjaGlsZCkge1xyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSBfKHRoaXMuY2hpbGRyZW4pLmluZGV4T2YoY2hpbGQpO1xyXG4gICAgICAgICAgICByZXR1cm4gaW5kZXggPiAwO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuY2FuTW92ZUNoaWxkRG93biA9IGZ1bmN0aW9uIChjaGlsZCkge1xyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSBfKHRoaXMuY2hpbGRyZW4pLmluZGV4T2YoY2hpbGQpO1xyXG4gICAgICAgICAgICByZXR1cm4gaW5kZXggPCB0aGlzLmNoaWxkcmVuLmxlbmd0aCAtIDE7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jaGlsZHJlblRvT2JqZWN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXyh0aGlzLmNoaWxkcmVuKS5tYXAoZnVuY3Rpb24gKGNoaWxkKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY2hpbGQudG9PYmplY3QoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5nZXRJbm5lclRleHQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBfKHRoaXMuY2hpbGRyZW4pLnJlZHVjZShmdW5jdGlvbiAobWVtbywgY2hpbGQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtZW1vICsgXCJcXG5cIiArIGNoaWxkLmdldElubmVyVGV4dCgpO1xyXG4gICAgICAgICAgICB9LCBcIlwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMucGFzdGUgPSBmdW5jdGlvbiAoY2xpcGJvYXJkRGF0YSkge1xyXG4gICAgICAgICAgICB2YXIganNvbiA9IGNsaXBib2FyZERhdGEuZ2V0RGF0YShcInRleHQvanNvblwiKTtcclxuICAgICAgICAgICAgaWYgKCEhanNvbikge1xyXG4gICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBKU09OLnBhcnNlKGpzb24pO1xyXG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkID0gTGF5b3V0RWRpdG9yLmVsZW1lbnRGcm9tKGRhdGEpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wYXN0ZUNoaWxkKGNoaWxkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMucGFzdGVDaGlsZCA9IGZ1bmN0aW9uIChjaGlsZCkge1xyXG4gICAgICAgICAgICBpZiAoXyh0aGlzLmFsbG93ZWRDaGlsZFR5cGVzKS5jb250YWlucyhjaGlsZC50eXBlKSB8fCBjaGlsZC5pc0NvbnRhaW5hYmxlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFkZENoaWxkKGNoaWxkKTtcclxuICAgICAgICAgICAgICAgIGNoaWxkLnNldElzRm9jdXNlZCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKCEhdGhpcy5wYXJlbnQpXHJcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudC5wYXN0ZUNoaWxkKGNoaWxkKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxufSkoTGF5b3V0RWRpdG9yIHx8IChMYXlvdXRFZGl0b3IgPSB7fSkpOyIsInZhciBMYXlvdXRFZGl0b3I7XHJcbihmdW5jdGlvbiAoTGF5b3V0RWRpdG9yKSB7XHJcblxyXG4gICAgTGF5b3V0RWRpdG9yLkNhbnZhcyA9IGZ1bmN0aW9uIChkYXRhLCBodG1sSWQsIGh0bWxDbGFzcywgaHRtbFN0eWxlLCBpc1RlbXBsYXRlZCwgcnVsZSwgY2hpbGRyZW4pIHtcclxuICAgICAgICBMYXlvdXRFZGl0b3IuRWxlbWVudC5jYWxsKHRoaXMsIFwiQ2FudmFzXCIsIGRhdGEsIGh0bWxJZCwgaHRtbENsYXNzLCBodG1sU3R5bGUsIGlzVGVtcGxhdGVkLCBydWxlKTtcclxuICAgICAgICBMYXlvdXRFZGl0b3IuQ29udGFpbmVyLmNhbGwodGhpcywgW1wiQ2FudmFzXCIsIFwiR3JpZFwiLCBcIkNvbnRlbnRcIl0sIGNoaWxkcmVuKTtcclxuXHJcbiAgICAgICAgdGhpcy5pc0NvbnRhaW5hYmxlID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgdGhpcy50b09iamVjdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHRoaXMuZWxlbWVudFRvT2JqZWN0KCk7XHJcbiAgICAgICAgICAgIHJlc3VsdC5jaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW5Ub09iamVjdCgpO1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgIH07XHJcbiAgICB9O1xyXG5cclxuICAgIExheW91dEVkaXRvci5DYW52YXMuZnJvbSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHZhciByZXN1bHQgPSBuZXcgTGF5b3V0RWRpdG9yLkNhbnZhcyhcclxuICAgICAgICAgICAgdmFsdWUuZGF0YSxcclxuICAgICAgICAgICAgdmFsdWUuaHRtbElkLFxyXG4gICAgICAgICAgICB2YWx1ZS5odG1sQ2xhc3MsXHJcbiAgICAgICAgICAgIHZhbHVlLmh0bWxTdHlsZSxcclxuICAgICAgICAgICAgdmFsdWUuaXNUZW1wbGF0ZWQsXHJcbiAgICAgICAgICAgIHZhbHVlLnJ1bGUsXHJcbiAgICAgICAgICAgIExheW91dEVkaXRvci5jaGlsZHJlbkZyb20odmFsdWUuY2hpbGRyZW4pKTtcclxuXHJcbiAgICAgICAgcmVzdWx0LnRvb2xib3hJY29uID0gdmFsdWUudG9vbGJveEljb247XHJcbiAgICAgICAgcmVzdWx0LnRvb2xib3hMYWJlbCA9IHZhbHVlLnRvb2xib3hMYWJlbDtcclxuICAgICAgICByZXN1bHQudG9vbGJveERlc2NyaXB0aW9uID0gdmFsdWUudG9vbGJveERlc2NyaXB0aW9uO1xyXG5cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfTtcclxuXHJcbn0pKExheW91dEVkaXRvciB8fCAoTGF5b3V0RWRpdG9yID0ge30pKTtcclxuIiwidmFyIExheW91dEVkaXRvcjtcclxuKGZ1bmN0aW9uIChMYXlvdXRFZGl0b3IpIHtcclxuXHJcbiAgICBMYXlvdXRFZGl0b3IuR3JpZCA9IGZ1bmN0aW9uIChkYXRhLCBodG1sSWQsIGh0bWxDbGFzcywgaHRtbFN0eWxlLCBpc1RlbXBsYXRlZCwgcnVsZSwgY2hpbGRyZW4pIHtcclxuICAgICAgICBMYXlvdXRFZGl0b3IuRWxlbWVudC5jYWxsKHRoaXMsIFwiR3JpZFwiLCBkYXRhLCBodG1sSWQsIGh0bWxDbGFzcywgaHRtbFN0eWxlLCBpc1RlbXBsYXRlZCwgcnVsZSk7XHJcbiAgICAgICAgTGF5b3V0RWRpdG9yLkNvbnRhaW5lci5jYWxsKHRoaXMsIFtcIlJvd1wiXSwgY2hpbGRyZW4pO1xyXG5cclxuICAgICAgICB0aGlzLnRvT2JqZWN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gdGhpcy5lbGVtZW50VG9PYmplY3QoKTtcclxuICAgICAgICAgICAgcmVzdWx0LmNoaWxkcmVuID0gdGhpcy5jaGlsZHJlblRvT2JqZWN0KCk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfTtcclxuICAgIH07XHJcblxyXG4gICAgTGF5b3V0RWRpdG9yLkdyaWQuZnJvbSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHZhciByZXN1bHQgPSBuZXcgTGF5b3V0RWRpdG9yLkdyaWQoXHJcbiAgICAgICAgICAgIHZhbHVlLmRhdGEsXHJcbiAgICAgICAgICAgIHZhbHVlLmh0bWxJZCxcclxuICAgICAgICAgICAgdmFsdWUuaHRtbENsYXNzLFxyXG4gICAgICAgICAgICB2YWx1ZS5odG1sU3R5bGUsXHJcbiAgICAgICAgICAgIHZhbHVlLmlzVGVtcGxhdGVkLFxyXG4gICAgICAgICAgICB2YWx1ZS5ydWxlLFxyXG4gICAgICAgICAgICBMYXlvdXRFZGl0b3IuY2hpbGRyZW5Gcm9tKHZhbHVlLmNoaWxkcmVuKSk7XHJcbiAgICAgICAgcmVzdWx0LnRvb2xib3hJY29uID0gdmFsdWUudG9vbGJveEljb247XHJcbiAgICAgICAgcmVzdWx0LnRvb2xib3hMYWJlbCA9IHZhbHVlLnRvb2xib3hMYWJlbDtcclxuICAgICAgICByZXN1bHQudG9vbGJveERlc2NyaXB0aW9uID0gdmFsdWUudG9vbGJveERlc2NyaXB0aW9uO1xyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG5cclxufSkoTGF5b3V0RWRpdG9yIHx8IChMYXlvdXRFZGl0b3IgPSB7fSkpOyIsInZhciBMYXlvdXRFZGl0b3I7XHJcbihmdW5jdGlvbiAoTGF5b3V0RWRpdG9yKSB7XHJcblxyXG4gICAgTGF5b3V0RWRpdG9yLlJvdyA9IGZ1bmN0aW9uIChkYXRhLCBodG1sSWQsIGh0bWxDbGFzcywgaHRtbFN0eWxlLCBpc1RlbXBsYXRlZCwgcnVsZSwgY2hpbGRyZW4pIHtcclxuICAgICAgICBMYXlvdXRFZGl0b3IuRWxlbWVudC5jYWxsKHRoaXMsIFwiUm93XCIsIGRhdGEsIGh0bWxJZCwgaHRtbENsYXNzLCBodG1sU3R5bGUsIGlzVGVtcGxhdGVkLCBydWxlKTtcclxuICAgICAgICBMYXlvdXRFZGl0b3IuQ29udGFpbmVyLmNhbGwodGhpcywgW1wiQ29sdW1uXCJdLCBjaGlsZHJlbik7XHJcblxyXG4gICAgICAgIHZhciBfc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9nZXRUb3RhbENvbHVtbnNXaWR0aCgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIF8oX3NlbGYuY2hpbGRyZW4pLnJlZHVjZShmdW5jdGlvbiAobWVtbywgY2hpbGQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtZW1vICsgY2hpbGQub2Zmc2V0ICsgY2hpbGQud2lkdGg7XHJcbiAgICAgICAgICAgIH0sIDApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gSW1wbGVtZW50cyBhIHNpbXBsZSBhbGdvcml0aG0gdG8gZGlzdHJpYnV0ZSBzcGFjZSAoZWl0aGVyIHBvc2l0aXZlIG9yIG5lZ2F0aXZlKVxyXG4gICAgICAgIC8vIGJldHdlZW4gdGhlIGNoaWxkIGNvbHVtbnMgb2YgdGhlIHJvdy4gTmVnYXRpdmUgc3BhY2UgaXMgZGlzdHJpYnV0ZWQgd2hlbiBtYWtpbmdcclxuICAgICAgICAvLyByb29tIGZvciBhIG5ldyBjb2x1bW4gKGUuYy4gY2xpcGJvYXJkIHBhc3RlIG9yIGRyb3BwaW5nIGZyb20gdGhlIHRvb2xib3gpIHdoaWxlXHJcbiAgICAgICAgLy8gcG9zaXRpdmUgc3BhY2UgaXMgZGlzdHJpYnV0ZWQgd2hlbiBmaWxsaW5nIHRoZSBncmFwIG9mIGEgcmVtb3ZlZCBjb2x1bW4uXHJcbiAgICAgICAgZnVuY3Rpb24gX2Rpc3RyaWJ1dGVTcGFjZShzcGFjZSkge1xyXG4gICAgICAgICAgICBpZiAoc3BhY2UgPT0gMClcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciB1bmRpc3RyaWJ1dGVkU3BhY2UgPSBzcGFjZTtcclxuXHJcbiAgICAgICAgICAgIGlmICh1bmRpc3RyaWJ1dGVkU3BhY2UgPCAwKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgdmFjYW50U3BhY2UgPSAxMiAtIF9nZXRUb3RhbENvbHVtbnNXaWR0aCgpO1xyXG4gICAgICAgICAgICAgICAgdW5kaXN0cmlidXRlZFNwYWNlICs9IHZhY2FudFNwYWNlO1xyXG4gICAgICAgICAgICAgICAgaWYgKHVuZGlzdHJpYnV0ZWRTcGFjZSA+IDApXHJcbiAgICAgICAgICAgICAgICAgICAgdW5kaXN0cmlidXRlZFNwYWNlID0gMDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gSWYgc3BhY2UgaXMgbmVnYXRpdmUsIHRyeSB0byBkZWNyZWFzZSBvZmZzZXRzIGZpcnN0LlxyXG4gICAgICAgICAgICB3aGlsZSAodW5kaXN0cmlidXRlZFNwYWNlIDwgMCAmJiBfKF9zZWxmLmNoaWxkcmVuKS5hbnkoZnVuY3Rpb24gKGNvbHVtbikgeyByZXR1cm4gY29sdW1uLm9mZnNldCA+IDA7IH0pKSB7IC8vIFdoaWxlIHRoZXJlIGlzIHN0aWxsIG9mZnNldCBsZWZ0IHRvIHJlbW92ZS5cclxuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBfc2VsZi5jaGlsZHJlbi5sZW5ndGggJiYgdW5kaXN0cmlidXRlZFNwYWNlIDwgMDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNvbHVtbiA9IF9zZWxmLmNoaWxkcmVuW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjb2x1bW4ub2Zmc2V0ID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW4ub2Zmc2V0LS07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuZGlzdHJpYnV0ZWRTcGFjZSsrO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gaGFzV2lkdGgoY29sdW1uKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodW5kaXN0cmlidXRlZFNwYWNlID4gMClcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29sdW1uLndpZHRoIDwgMTI7XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh1bmRpc3RyaWJ1dGVkU3BhY2UgPCAwKVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb2x1bW4ud2lkdGggPiAxO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBUcnkgdG8gZGlzdHJpYnV0ZSByZW1haW5pbmcgc3BhY2UgKGNvdWxkIGJlIG5lZ2F0aXZlIG9yIHBvc2l0aXZlKSB1c2luZyB3aWR0aHMuXHJcbiAgICAgICAgICAgIHdoaWxlICh1bmRpc3RyaWJ1dGVkU3BhY2UgIT0gMCkge1xyXG4gICAgICAgICAgICAgICAgLy8gQW55IG1vcmUgY29sdW1uIHdpZHRoIGF2YWlsYWJsZSBmb3IgZGlzdHJpYnV0aW9uP1xyXG4gICAgICAgICAgICAgICAgaWYgKCFfKF9zZWxmLmNoaWxkcmVuKS5hbnkoaGFzV2lkdGgpKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IF9zZWxmLmNoaWxkcmVuLmxlbmd0aCAmJiB1bmRpc3RyaWJ1dGVkU3BhY2UgIT0gMDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNvbHVtbiA9IF9zZWxmLmNoaWxkcmVuW2kgJSBfc2VsZi5jaGlsZHJlbi5sZW5ndGhdO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChoYXNXaWR0aChjb2x1bW4pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkZWx0YSA9IHVuZGlzdHJpYnV0ZWRTcGFjZSAvIE1hdGguYWJzKHVuZGlzdHJpYnV0ZWRTcGFjZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbHVtbi53aWR0aCArPSBkZWx0YTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdW5kaXN0cmlidXRlZFNwYWNlIC09IGRlbHRhO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiB1bmRpc3RyaWJ1dGVkU3BhY2UgPT0gMDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBfaXNBZGRpbmdDb2x1bW4gPSBmYWxzZTtcclxuXHJcbiAgICAgICAgdGhpcy5jYW5BZGRDb2x1bW4gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNoaWxkcmVuLmxlbmd0aCA8IDEyO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuYmVnaW5BZGRDb2x1bW4gPSBmdW5jdGlvbiAobmV3Q29sdW1uV2lkdGgpIHtcclxuICAgICAgICAgICAgaWYgKCEhX2lzQWRkaW5nQ29sdW1uKVxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ29sdW1uIGFkZCBvcGVyYXRpb24gaXMgYWxyZWFkeSBpbiBwcm9ncmVzcy5cIilcclxuICAgICAgICAgICAgXyh0aGlzLmNoaWxkcmVuKS5lYWNoKGZ1bmN0aW9uIChjb2x1bW4pIHtcclxuICAgICAgICAgICAgICAgIGNvbHVtbi5iZWdpbkNoYW5nZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgaWYgKF9kaXN0cmlidXRlU3BhY2UoLW5ld0NvbHVtbldpZHRoKSkge1xyXG4gICAgICAgICAgICAgICAgX2lzQWRkaW5nQ29sdW1uID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIF8odGhpcy5jaGlsZHJlbikuZWFjaChmdW5jdGlvbiAoY29sdW1uKSB7XHJcbiAgICAgICAgICAgICAgICBjb2x1bW4ucm9sbGJhY2tDaGFuZ2UoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLmNvbW1pdEFkZENvbHVtbiA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKCFfaXNBZGRpbmdDb2x1bW4pXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBjb2x1bW4gYWRkIG9wZXJhdGlvbiBpbiBwcm9ncmVzcy5cIilcclxuICAgICAgICAgICAgXyh0aGlzLmNoaWxkcmVuKS5lYWNoKGZ1bmN0aW9uIChjb2x1bW4pIHtcclxuICAgICAgICAgICAgICAgIGNvbHVtbi5jb21taXRDaGFuZ2UoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIF9pc0FkZGluZ0NvbHVtbiA9IGZhbHNlO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMucm9sbGJhY2tBZGRDb2x1bW4gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICghX2lzQWRkaW5nQ29sdW1uKVxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gY29sdW1uIGFkZCBvcGVyYXRpb24gaW4gcHJvZ3Jlc3MuXCIpXHJcbiAgICAgICAgICAgIF8odGhpcy5jaGlsZHJlbikuZWFjaChmdW5jdGlvbiAoY29sdW1uKSB7XHJcbiAgICAgICAgICAgICAgICBjb2x1bW4ucm9sbGJhY2tDaGFuZ2UoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIF9pc0FkZGluZ0NvbHVtbiA9IGZhbHNlO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHZhciBfYmFzZURlbGV0ZUNoaWxkID0gdGhpcy5kZWxldGVDaGlsZDtcclxuICAgICAgICB0aGlzLmRlbGV0ZUNoaWxkID0gZnVuY3Rpb24gKGNvbHVtbikgeyBcclxuICAgICAgICAgICAgdmFyIHdpZHRoID0gY29sdW1uLndpZHRoO1xyXG4gICAgICAgICAgICBfYmFzZURlbGV0ZUNoaWxkLmNhbGwodGhpcywgY29sdW1uKTtcclxuICAgICAgICAgICAgX2Rpc3RyaWJ1dGVTcGFjZSh3aWR0aCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jYW5Db250cmFjdENvbHVtblJpZ2h0ID0gZnVuY3Rpb24gKGNvbHVtbiwgY29ubmVjdEFkamFjZW50KSB7XHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IF8odGhpcy5jaGlsZHJlbikuaW5kZXhPZihjb2x1bW4pO1xyXG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMClcclxuICAgICAgICAgICAgICAgIHJldHVybiBjb2x1bW4ud2lkdGggPiAxO1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jb250cmFjdENvbHVtblJpZ2h0ID0gZnVuY3Rpb24gKGNvbHVtbiwgY29ubmVjdEFkamFjZW50KSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5jYW5Db250cmFjdENvbHVtblJpZ2h0KGNvbHVtbiwgY29ubmVjdEFkamFjZW50KSlcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IF8odGhpcy5jaGlsZHJlbikuaW5kZXhPZihjb2x1bW4pO1xyXG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNvbHVtbi53aWR0aCA+IDEpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb2x1bW4ud2lkdGgtLTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5jaGlsZHJlbi5sZW5ndGggPiBpbmRleCArIDEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5leHRDb2x1bW4gPSB0aGlzLmNoaWxkcmVuW2luZGV4ICsgMV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb25uZWN0QWRqYWNlbnQgJiYgbmV4dENvbHVtbi5vZmZzZXQgPT0gMClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5leHRDb2x1bW4ud2lkdGgrKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV4dENvbHVtbi5vZmZzZXQrKztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLmNhbkV4cGFuZENvbHVtblJpZ2h0ID0gZnVuY3Rpb24gKGNvbHVtbiwgY29ubmVjdEFkamFjZW50KSB7XHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IF8odGhpcy5jaGlsZHJlbikuaW5kZXhPZihjb2x1bW4pO1xyXG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNvbHVtbi53aWR0aCA+PSAxMilcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jaGlsZHJlbi5sZW5ndGggPiBpbmRleCArIDEpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbmV4dENvbHVtbiA9IHRoaXMuY2hpbGRyZW5baW5kZXggKyAxXTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoY29ubmVjdEFkamFjZW50ICYmIG5leHRDb2x1bW4ub2Zmc2V0ID09IDApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXh0Q29sdW1uLndpZHRoID4gMTtcclxuICAgICAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXh0Q29sdW1uLm9mZnNldCA+IDA7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gX2dldFRvdGFsQ29sdW1uc1dpZHRoKCkgPCAxMjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5leHBhbmRDb2x1bW5SaWdodCA9IGZ1bmN0aW9uIChjb2x1bW4sIGNvbm5lY3RBZGphY2VudCkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuY2FuRXhwYW5kQ29sdW1uUmlnaHQoY29sdW1uLCBjb25uZWN0QWRqYWNlbnQpKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgdmFyIGluZGV4ID0gXyh0aGlzLmNoaWxkcmVuKS5pbmRleE9mKGNvbHVtbik7XHJcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jaGlsZHJlbi5sZW5ndGggPiBpbmRleCArIDEpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbmV4dENvbHVtbiA9IHRoaXMuY2hpbGRyZW5baW5kZXggKyAxXTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoY29ubmVjdEFkamFjZW50ICYmIG5leHRDb2x1bW4ub2Zmc2V0ID09IDApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHRDb2x1bW4ud2lkdGgtLTtcclxuICAgICAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHRDb2x1bW4ub2Zmc2V0LS07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjb2x1bW4ud2lkdGgrKztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuY2FuRXhwYW5kQ29sdW1uTGVmdCA9IGZ1bmN0aW9uIChjb2x1bW4sIGNvbm5lY3RBZGphY2VudCkge1xyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSBfKHRoaXMuY2hpbGRyZW4pLmluZGV4T2YoY29sdW1uKTtcclxuICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcclxuICAgICAgICAgICAgICAgIGlmIChjb2x1bW4ud2lkdGggPj0gMTIpXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwcmV2Q29sdW1uID0gdGhpcy5jaGlsZHJlbltpbmRleCAtIDFdO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjb25uZWN0QWRqYWNlbnQgJiYgY29sdW1uLm9mZnNldCA9PSAwKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJldkNvbHVtbi53aWR0aCA+IDE7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY29sdW1uLm9mZnNldCA+IDA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuZXhwYW5kQ29sdW1uTGVmdCA9IGZ1bmN0aW9uIChjb2x1bW4sIGNvbm5lY3RBZGphY2VudCkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuY2FuRXhwYW5kQ29sdW1uTGVmdChjb2x1bW4sIGNvbm5lY3RBZGphY2VudCkpXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSBfKHRoaXMuY2hpbGRyZW4pLmluZGV4T2YoY29sdW1uKTtcclxuICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcclxuICAgICAgICAgICAgICAgIGlmIChpbmRleCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcHJldkNvbHVtbiA9IHRoaXMuY2hpbGRyZW5baW5kZXggLSAxXTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoY29ubmVjdEFkamFjZW50ICYmIGNvbHVtbi5vZmZzZXQgPT0gMClcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJldkNvbHVtbi53aWR0aC0tO1xyXG4gICAgICAgICAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uLm9mZnNldC0tO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAgIGNvbHVtbi5vZmZzZXQtLTtcclxuICAgICAgICAgICAgICAgIGNvbHVtbi53aWR0aCsrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jYW5Db250cmFjdENvbHVtbkxlZnQgPSBmdW5jdGlvbiAoY29sdW1uLCBjb25uZWN0QWRqYWNlbnQpIHtcclxuICAgICAgICAgICAgdmFyIGluZGV4ID0gXyh0aGlzLmNoaWxkcmVuKS5pbmRleE9mKGNvbHVtbik7XHJcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbHVtbi53aWR0aCA+IDE7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLmNvbnRyYWN0Q29sdW1uTGVmdCA9IGZ1bmN0aW9uIChjb2x1bW4sIGNvbm5lY3RBZGphY2VudCkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuY2FuQ29udHJhY3RDb2x1bW5MZWZ0KGNvbHVtbiwgY29ubmVjdEFkamFjZW50KSlcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IF8odGhpcy5jaGlsZHJlbikuaW5kZXhPZihjb2x1bW4pO1xyXG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwcmV2Q29sdW1uID0gdGhpcy5jaGlsZHJlbltpbmRleCAtIDFdO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjb25uZWN0QWRqYWNlbnQgJiYgY29sdW1uLm9mZnNldCA9PSAwKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2Q29sdW1uLndpZHRoKys7XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW4ub2Zmc2V0Kys7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgY29sdW1uLm9mZnNldCsrO1xyXG4gICAgICAgICAgICAgICAgY29sdW1uLndpZHRoLS07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLmV2ZW5Db2x1bW5zID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5jaGlsZHJlbi5sZW5ndGggPT0gMClcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIHZhciBldmVuV2lkdGggPSBNYXRoLmZsb29yKDEyIC8gdGhpcy5jaGlsZHJlbi5sZW5ndGgpO1xyXG4gICAgICAgICAgICBfKHRoaXMuY2hpbGRyZW4pLmVhY2goZnVuY3Rpb24gKGNvbHVtbikge1xyXG4gICAgICAgICAgICAgICAgY29sdW1uLndpZHRoID0gZXZlbldpZHRoO1xyXG4gICAgICAgICAgICAgICAgY29sdW1uLm9mZnNldCA9IDA7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgdmFyIHJlc3QgPSAxMiAlIHRoaXMuY2hpbGRyZW4ubGVuZ3RoO1xyXG4gICAgICAgICAgICBpZiAocmVzdCA+IDApXHJcbiAgICAgICAgICAgICAgICBfZGlzdHJpYnV0ZVNwYWNlKHJlc3QpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHZhciBfYmFzZVBhc3RlQ2hpbGQgPSB0aGlzLnBhc3RlQ2hpbGQ7XHJcbiAgICAgICAgdGhpcy5wYXN0ZUNoaWxkID0gZnVuY3Rpb24gKGNoaWxkKSB7XHJcbiAgICAgICAgICAgIGlmIChjaGlsZC50eXBlID09IFwiQ29sdW1uXCIpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmJlZ2luQWRkQ29sdW1uKGNoaWxkLndpZHRoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29tbWl0QWRkQ29sdW1uKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgX2Jhc2VQYXN0ZUNoaWxkLmNhbGwodGhpcywgY2hpbGQpXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAoISF0aGlzLnBhcmVudClcclxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50LnBhc3RlQ2hpbGQoY2hpbGQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy50b09iamVjdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHRoaXMuZWxlbWVudFRvT2JqZWN0KCk7XHJcbiAgICAgICAgICAgIHJlc3VsdC5jaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW5Ub09iamVjdCgpO1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgIH07XHJcbiAgICB9O1xyXG5cclxuICAgIExheW91dEVkaXRvci5Sb3cuZnJvbSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHZhciByZXN1bHQgPSBuZXcgTGF5b3V0RWRpdG9yLlJvdyhcclxuICAgICAgICAgICAgdmFsdWUuZGF0YSxcclxuICAgICAgICAgICAgdmFsdWUuaHRtbElkLFxyXG4gICAgICAgICAgICB2YWx1ZS5odG1sQ2xhc3MsXHJcbiAgICAgICAgICAgIHZhbHVlLmh0bWxTdHlsZSxcclxuICAgICAgICAgICAgdmFsdWUuaXNUZW1wbGF0ZWQsXHJcbiAgICAgICAgICAgIHZhbHVlLnJ1bGUsXHJcbiAgICAgICAgICAgIExheW91dEVkaXRvci5jaGlsZHJlbkZyb20odmFsdWUuY2hpbGRyZW4pKTtcclxuICAgICAgICByZXN1bHQudG9vbGJveEljb24gPSB2YWx1ZS50b29sYm94SWNvbjtcclxuICAgICAgICByZXN1bHQudG9vbGJveExhYmVsID0gdmFsdWUudG9vbGJveExhYmVsO1xyXG4gICAgICAgIHJlc3VsdC50b29sYm94RGVzY3JpcHRpb24gPSB2YWx1ZS50b29sYm94RGVzY3JpcHRpb247XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH07XHJcblxyXG59KShMYXlvdXRFZGl0b3IgfHwgKExheW91dEVkaXRvciA9IHt9KSk7IiwidmFyIExheW91dEVkaXRvcjtcclxuKGZ1bmN0aW9uIChMYXlvdXRFZGl0b3IpIHtcclxuICAgIExheW91dEVkaXRvci5Db2x1bW4gPSBmdW5jdGlvbiAoZGF0YSwgaHRtbElkLCBodG1sQ2xhc3MsIGh0bWxTdHlsZSwgaXNUZW1wbGF0ZWQsIHdpZHRoLCBvZmZzZXQsIGNvbGxhcHNpYmxlLCBydWxlLCBjaGlsZHJlbikge1xyXG4gICAgICAgIExheW91dEVkaXRvci5FbGVtZW50LmNhbGwodGhpcywgXCJDb2x1bW5cIiwgZGF0YSwgaHRtbElkLCBodG1sQ2xhc3MsIGh0bWxTdHlsZSwgaXNUZW1wbGF0ZWQsIHJ1bGUpO1xyXG4gICAgICAgIExheW91dEVkaXRvci5Db250YWluZXIuY2FsbCh0aGlzLCBbXCJHcmlkXCIsIFwiQ29udGVudFwiXSwgY2hpbGRyZW4pO1xyXG5cclxuICAgICAgICB0aGlzLndpZHRoID0gd2lkdGg7XHJcbiAgICAgICAgdGhpcy5vZmZzZXQgPSBvZmZzZXQ7XHJcbiAgICAgICAgdGhpcy5jb2xsYXBzaWJsZSA9IGNvbGxhcHNpYmxlO1xyXG5cclxuICAgICAgICB2YXIgX2hhc1BlbmRpbmdDaGFuZ2UgPSBmYWxzZTtcclxuICAgICAgICB2YXIgX29yaWdXaWR0aCA9IDA7XHJcbiAgICAgICAgdmFyIF9vcmlnT2Zmc2V0ID0gMDtcclxuXHJcbiAgICAgICAgdGhpcy5iZWdpbkNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKCEhX2hhc1BlbmRpbmdDaGFuZ2UpXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb2x1bW4gYWxyZWFkeSBoYXMgYSBwZW5kaW5nIGNoYW5nZS5cIik7XHJcbiAgICAgICAgICAgIF9oYXNQZW5kaW5nQ2hhbmdlID0gdHJ1ZTtcclxuICAgICAgICAgICAgX29yaWdXaWR0aCA9IHRoaXMud2lkdGg7XHJcbiAgICAgICAgICAgIF9vcmlnT2Zmc2V0ID0gdGhpcy5vZmZzZXQ7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jb21taXRDaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICghX2hhc1BlbmRpbmdDaGFuZ2UpXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb2x1bW4gaGFzIG5vIHBlbmRpbmcgY2hhbmdlLlwiKTtcclxuICAgICAgICAgICAgX29yaWdXaWR0aCA9IDA7XHJcbiAgICAgICAgICAgIF9vcmlnT2Zmc2V0ID0gMDtcclxuICAgICAgICAgICAgX2hhc1BlbmRpbmdDaGFuZ2UgPSBmYWxzZTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLnJvbGxiYWNrQ2hhbmdlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAoIV9oYXNQZW5kaW5nQ2hhbmdlKVxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ29sdW1uIGhhcyBubyBwZW5kaW5nIGNoYW5nZS5cIik7XHJcbiAgICAgICAgICAgIHRoaXMud2lkdGggPSBfb3JpZ1dpZHRoO1xyXG4gICAgICAgICAgICB0aGlzLm9mZnNldCA9IF9vcmlnT2Zmc2V0O1xyXG4gICAgICAgICAgICBfb3JpZ1dpZHRoID0gMDtcclxuICAgICAgICAgICAgX29yaWdPZmZzZXQgPSAwO1xyXG4gICAgICAgICAgICBfaGFzUGVuZGluZ0NoYW5nZSA9IGZhbHNlO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuY2FuU3BsaXQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmlzVGVtcGxhdGVkKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy53aWR0aCA+IDE7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5zcGxpdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmNhblNwbGl0KCkpXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgICAgICB2YXIgbmV3Q29sdW1uV2lkdGggPSBNYXRoLmZsb29yKHRoaXMud2lkdGggLyAyKTtcclxuICAgICAgICAgICAgdmFyIG5ld0NvbHVtbiA9IExheW91dEVkaXRvci5Db2x1bW4uZnJvbSh7XHJcbiAgICAgICAgICAgICAgICBkYXRhOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgaHRtbElkOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgaHRtbENsYXNzOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgaHRtbFN0eWxlOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgd2lkdGg6IG5ld0NvbHVtbldpZHRoLFxyXG4gICAgICAgICAgICAgICAgb2Zmc2V0OiAwLFxyXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IFtdXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgdGhpcy53aWR0aCA9IHRoaXMud2lkdGggLSBuZXdDb2x1bW5XaWR0aDtcclxuICAgICAgICAgICAgdGhpcy5wYXJlbnQuaW5zZXJ0Q2hpbGQobmV3Q29sdW1uLCB0aGlzKTtcclxuICAgICAgICAgICAgbmV3Q29sdW1uLnNldElzRm9jdXNlZCgpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuY2FuQ29udHJhY3RSaWdodCA9IGZ1bmN0aW9uIChjb25uZWN0QWRqYWNlbnQpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNUZW1wbGF0ZWQpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcmVudC5jYW5Db250cmFjdENvbHVtblJpZ2h0KHRoaXMsIGNvbm5lY3RBZGphY2VudCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jb250cmFjdFJpZ2h0ID0gZnVuY3Rpb24gKGNvbm5lY3RBZGphY2VudCkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuY2FuQ29udHJhY3RSaWdodChjb25uZWN0QWRqYWNlbnQpKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB0aGlzLnBhcmVudC5jb250cmFjdENvbHVtblJpZ2h0KHRoaXMsIGNvbm5lY3RBZGphY2VudCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jYW5FeHBhbmRSaWdodCA9IGZ1bmN0aW9uIChjb25uZWN0QWRqYWNlbnQpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNUZW1wbGF0ZWQpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcmVudC5jYW5FeHBhbmRDb2x1bW5SaWdodCh0aGlzLCBjb25uZWN0QWRqYWNlbnQpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuZXhwYW5kUmlnaHQgPSBmdW5jdGlvbiAoY29ubmVjdEFkamFjZW50KSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5jYW5FeHBhbmRSaWdodChjb25uZWN0QWRqYWNlbnQpKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB0aGlzLnBhcmVudC5leHBhbmRDb2x1bW5SaWdodCh0aGlzLCBjb25uZWN0QWRqYWNlbnQpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuY2FuRXhwYW5kTGVmdCA9IGZ1bmN0aW9uIChjb25uZWN0QWRqYWNlbnQpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNUZW1wbGF0ZWQpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcmVudC5jYW5FeHBhbmRDb2x1bW5MZWZ0KHRoaXMsIGNvbm5lY3RBZGphY2VudCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5leHBhbmRMZWZ0ID0gZnVuY3Rpb24gKGNvbm5lY3RBZGphY2VudCkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuY2FuRXhwYW5kTGVmdChjb25uZWN0QWRqYWNlbnQpKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB0aGlzLnBhcmVudC5leHBhbmRDb2x1bW5MZWZ0KHRoaXMsIGNvbm5lY3RBZGphY2VudCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jYW5Db250cmFjdExlZnQgPSBmdW5jdGlvbiAoY29ubmVjdEFkamFjZW50KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmlzVGVtcGxhdGVkKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXJlbnQuY2FuQ29udHJhY3RDb2x1bW5MZWZ0KHRoaXMsIGNvbm5lY3RBZGphY2VudCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jb250cmFjdExlZnQgPSBmdW5jdGlvbiAoY29ubmVjdEFkamFjZW50KSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5jYW5Db250cmFjdExlZnQoY29ubmVjdEFkamFjZW50KSlcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgdGhpcy5wYXJlbnQuY29udHJhY3RDb2x1bW5MZWZ0KHRoaXMsIGNvbm5lY3RBZGphY2VudCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy50b09iamVjdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHRoaXMuZWxlbWVudFRvT2JqZWN0KCk7XHJcbiAgICAgICAgICAgIHJlc3VsdC53aWR0aCA9IHRoaXMud2lkdGg7XHJcbiAgICAgICAgICAgIHJlc3VsdC5vZmZzZXQgPSB0aGlzLm9mZnNldDtcclxuICAgICAgICAgICAgcmVzdWx0LmNvbGxhcHNpYmxlID0gdGhpcy5jb2xsYXBzaWJsZTtcclxuICAgICAgICAgICAgcmVzdWx0LmNoaWxkcmVuID0gdGhpcy5jaGlsZHJlblRvT2JqZWN0KCk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfTtcclxuICAgIH07XHJcblxyXG4gICAgTGF5b3V0RWRpdG9yLkNvbHVtbi5mcm9tID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IG5ldyBMYXlvdXRFZGl0b3IuQ29sdW1uKFxyXG4gICAgICAgICAgICB2YWx1ZS5kYXRhLFxyXG4gICAgICAgICAgICB2YWx1ZS5odG1sSWQsXHJcbiAgICAgICAgICAgIHZhbHVlLmh0bWxDbGFzcyxcclxuICAgICAgICAgICAgdmFsdWUuaHRtbFN0eWxlLFxyXG4gICAgICAgICAgICB2YWx1ZS5pc1RlbXBsYXRlZCxcclxuICAgICAgICAgICAgdmFsdWUud2lkdGgsXHJcbiAgICAgICAgICAgIHZhbHVlLm9mZnNldCxcclxuICAgICAgICAgICAgdmFsdWUuY29sbGFwc2libGUsXHJcbiAgICAgICAgICAgIHZhbHVlLnJ1bGUsXHJcbiAgICAgICAgICAgIExheW91dEVkaXRvci5jaGlsZHJlbkZyb20odmFsdWUuY2hpbGRyZW4pKTtcclxuICAgICAgICByZXN1bHQudG9vbGJveEljb24gPSB2YWx1ZS50b29sYm94SWNvbjtcclxuICAgICAgICByZXN1bHQudG9vbGJveExhYmVsID0gdmFsdWUudG9vbGJveExhYmVsO1xyXG4gICAgICAgIHJlc3VsdC50b29sYm94RGVzY3JpcHRpb24gPSB2YWx1ZS50b29sYm94RGVzY3JpcHRpb247XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH07XHJcblxyXG4gICAgTGF5b3V0RWRpdG9yLkNvbHVtbi50aW1lcyA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHJldHVybiBfLnRpbWVzKHZhbHVlLCBmdW5jdGlvbiAobikge1xyXG4gICAgICAgICAgICByZXR1cm4gTGF5b3V0RWRpdG9yLkNvbHVtbi5mcm9tKHtcclxuICAgICAgICAgICAgICAgIGRhdGE6IG51bGwsXHJcbiAgICAgICAgICAgICAgICBodG1sSWQ6IG51bGwsXHJcbiAgICAgICAgICAgICAgICBodG1sQ2xhc3M6IG51bGwsXHJcbiAgICAgICAgICAgICAgICBpc1RlbXBsYXRlZDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogMTIgLyB2YWx1ZSxcclxuICAgICAgICAgICAgICAgIG9mZnNldDogMCxcclxuICAgICAgICAgICAgICAgIGNvbGxhcHNpYmxlOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IFtdXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxufSkoTGF5b3V0RWRpdG9yIHx8IChMYXlvdXRFZGl0b3IgPSB7fSkpOyIsInZhciBMYXlvdXRFZGl0b3I7XHJcbihmdW5jdGlvbiAoTGF5b3V0RWRpdG9yKSB7XHJcblxyXG4gICAgTGF5b3V0RWRpdG9yLkNvbnRlbnQgPSBmdW5jdGlvbiAoZGF0YSwgaHRtbElkLCBodG1sQ2xhc3MsIGh0bWxTdHlsZSwgaXNUZW1wbGF0ZWQsIGNvbnRlbnRUeXBlLCBjb250ZW50VHlwZUxhYmVsLCBjb250ZW50VHlwZUNsYXNzLCBodG1sLCBoYXNFZGl0b3IsIHJ1bGUpIHtcclxuICAgICAgICBMYXlvdXRFZGl0b3IuRWxlbWVudC5jYWxsKHRoaXMsIFwiQ29udGVudFwiLCBkYXRhLCBodG1sSWQsIGh0bWxDbGFzcywgaHRtbFN0eWxlLCBpc1RlbXBsYXRlZCwgcnVsZSk7XHJcblxyXG4gICAgICAgIHRoaXMuY29udGVudFR5cGUgPSBjb250ZW50VHlwZTtcclxuICAgICAgICB0aGlzLmNvbnRlbnRUeXBlTGFiZWwgPSBjb250ZW50VHlwZUxhYmVsO1xyXG4gICAgICAgIHRoaXMuY29udGVudFR5cGVDbGFzcyA9IGNvbnRlbnRUeXBlQ2xhc3M7XHJcbiAgICAgICAgdGhpcy5odG1sID0gaHRtbDtcclxuICAgICAgICB0aGlzLmhhc0VkaXRvciA9IGhhc0VkaXRvcjtcclxuXHJcbiAgICAgICAgdGhpcy5nZXRJbm5lclRleHQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAkKCQucGFyc2VIVE1MKFwiPGRpdj5cIiArIHRoaXMuaHRtbCArIFwiPC9kaXY+XCIpKS50ZXh0KCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLy8gVGhpcyBmdW5jdGlvbiB3aWxsIGJlIG92ZXJ3cml0dGVuIGJ5IHRoZSBDb250ZW50IGRpcmVjdGl2ZS5cclxuICAgICAgICB0aGlzLnNldEh0bWwgPSBmdW5jdGlvbiAoaHRtbCkge1xyXG4gICAgICAgICAgICB0aGlzLmh0bWwgPSBodG1sO1xyXG4gICAgICAgICAgICB0aGlzLmh0bWxVbnNhZmUgPSBodG1sO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy50b09iamVjdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIkNvbnRlbnRcIlxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMudG9PYmplY3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSB0aGlzLmVsZW1lbnRUb09iamVjdCgpO1xyXG4gICAgICAgICAgICByZXN1bHQuY29udGVudFR5cGUgPSB0aGlzLmNvbnRlbnRUeXBlO1xyXG4gICAgICAgICAgICByZXN1bHQuY29udGVudFR5cGVMYWJlbCA9IHRoaXMuY29udGVudFR5cGVMYWJlbDtcclxuICAgICAgICAgICAgcmVzdWx0LmNvbnRlbnRUeXBlQ2xhc3MgPSB0aGlzLmNvbnRlbnRUeXBlQ2xhc3M7XHJcbiAgICAgICAgICAgIHJlc3VsdC5odG1sID0gdGhpcy5odG1sO1xyXG4gICAgICAgICAgICByZXN1bHQuaGFzRWRpdG9yID0gaGFzRWRpdG9yO1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuc2V0SHRtbChodG1sKTtcclxuICAgIH07XHJcblxyXG4gICAgTGF5b3V0RWRpdG9yLkNvbnRlbnQuZnJvbSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHZhciByZXN1bHQgPSBuZXcgTGF5b3V0RWRpdG9yLkNvbnRlbnQoXHJcbiAgICAgICAgICAgIHZhbHVlLmRhdGEsXHJcbiAgICAgICAgICAgIHZhbHVlLmh0bWxJZCxcclxuICAgICAgICAgICAgdmFsdWUuaHRtbENsYXNzLFxyXG4gICAgICAgICAgICB2YWx1ZS5odG1sU3R5bGUsXHJcbiAgICAgICAgICAgIHZhbHVlLmlzVGVtcGxhdGVkLFxyXG4gICAgICAgICAgICB2YWx1ZS5jb250ZW50VHlwZSxcclxuICAgICAgICAgICAgdmFsdWUuY29udGVudFR5cGVMYWJlbCxcclxuICAgICAgICAgICAgdmFsdWUuY29udGVudFR5cGVDbGFzcyxcclxuICAgICAgICAgICAgdmFsdWUuaHRtbCxcclxuICAgICAgICAgICAgdmFsdWUuaGFzRWRpdG9yLFxyXG4gICAgICAgICAgICB2YWx1ZS5ydWxlKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH07XHJcblxyXG59KShMYXlvdXRFZGl0b3IgfHwgKExheW91dEVkaXRvciA9IHt9KSk7IiwidmFyIExheW91dEVkaXRvcjtcclxuKGZ1bmN0aW9uICgkLCBMYXlvdXRFZGl0b3IpIHtcclxuXHJcbiAgICBMYXlvdXRFZGl0b3IuSHRtbCA9IGZ1bmN0aW9uIChkYXRhLCBodG1sSWQsIGh0bWxDbGFzcywgaHRtbFN0eWxlLCBpc1RlbXBsYXRlZCwgY29udGVudFR5cGUsIGNvbnRlbnRUeXBlTGFiZWwsIGNvbnRlbnRUeXBlQ2xhc3MsIGh0bWwsIGhhc0VkaXRvciwgcnVsZSkge1xyXG4gICAgICAgIExheW91dEVkaXRvci5FbGVtZW50LmNhbGwodGhpcywgXCJIdG1sXCIsIGRhdGEsIGh0bWxJZCwgaHRtbENsYXNzLCBodG1sU3R5bGUsIGlzVGVtcGxhdGVkLCBydWxlKTtcclxuXHJcbiAgICAgICAgdGhpcy5jb250ZW50VHlwZSA9IGNvbnRlbnRUeXBlO1xyXG4gICAgICAgIHRoaXMuY29udGVudFR5cGVMYWJlbCA9IGNvbnRlbnRUeXBlTGFiZWw7XHJcbiAgICAgICAgdGhpcy5jb250ZW50VHlwZUNsYXNzID0gY29udGVudFR5cGVDbGFzcztcclxuICAgICAgICB0aGlzLmh0bWwgPSBodG1sO1xyXG4gICAgICAgIHRoaXMuaGFzRWRpdG9yID0gaGFzRWRpdG9yO1xyXG4gICAgICAgIHRoaXMuaXNDb250YWluYWJsZSA9IHRydWU7XHJcblxyXG4gICAgICAgIHRoaXMuZ2V0SW5uZXJUZXh0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJCgkLnBhcnNlSFRNTChcIjxkaXY+XCIgKyB0aGlzLmh0bWwgKyBcIjwvZGl2PlwiKSkudGV4dCgpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIC8vIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBvdmVyd3JpdHRlbiBieSB0aGUgQ29udGVudCBkaXJlY3RpdmUuXHJcbiAgICAgICAgdGhpcy5zZXRIdG1sID0gZnVuY3Rpb24gKGh0bWwpIHtcclxuICAgICAgICAgICAgdGhpcy5odG1sID0gaHRtbDtcclxuICAgICAgICAgICAgdGhpcy5odG1sVW5zYWZlID0gaHRtbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMudG9PYmplY3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJIdG1sXCJcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLnRvT2JqZWN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gdGhpcy5lbGVtZW50VG9PYmplY3QoKTtcclxuICAgICAgICAgICAgcmVzdWx0LmNvbnRlbnRUeXBlID0gdGhpcy5jb250ZW50VHlwZTtcclxuICAgICAgICAgICAgcmVzdWx0LmNvbnRlbnRUeXBlTGFiZWwgPSB0aGlzLmNvbnRlbnRUeXBlTGFiZWw7XHJcbiAgICAgICAgICAgIHJlc3VsdC5jb250ZW50VHlwZUNsYXNzID0gdGhpcy5jb250ZW50VHlwZUNsYXNzO1xyXG4gICAgICAgICAgICByZXN1bHQuaHRtbCA9IHRoaXMuaHRtbDtcclxuICAgICAgICAgICAgcmVzdWx0Lmhhc0VkaXRvciA9IGhhc0VkaXRvcjtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB2YXIgZ2V0RWRpdG9yT2JqZWN0ID0gdGhpcy5nZXRFZGl0b3JPYmplY3Q7XHJcbiAgICAgICAgdGhpcy5nZXRFZGl0b3JPYmplY3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciBkdG8gPSBnZXRFZGl0b3JPYmplY3QoKTtcclxuICAgICAgICAgICAgcmV0dXJuICQuZXh0ZW5kKGR0bywge1xyXG4gICAgICAgICAgICAgICAgQ29udGVudDogdGhpcy5odG1sXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5zZXRIdG1sKGh0bWwpO1xyXG4gICAgfTtcclxuXHJcbiAgICBMYXlvdXRFZGl0b3IuSHRtbC5mcm9tID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IG5ldyBMYXlvdXRFZGl0b3IuSHRtbChcclxuICAgICAgICAgICAgdmFsdWUuZGF0YSxcclxuICAgICAgICAgICAgdmFsdWUuaHRtbElkLFxyXG4gICAgICAgICAgICB2YWx1ZS5odG1sQ2xhc3MsXHJcbiAgICAgICAgICAgIHZhbHVlLmh0bWxTdHlsZSxcclxuICAgICAgICAgICAgdmFsdWUuaXNUZW1wbGF0ZWQsXHJcbiAgICAgICAgICAgIHZhbHVlLmNvbnRlbnRUeXBlLFxyXG4gICAgICAgICAgICB2YWx1ZS5jb250ZW50VHlwZUxhYmVsLFxyXG4gICAgICAgICAgICB2YWx1ZS5jb250ZW50VHlwZUNsYXNzLFxyXG4gICAgICAgICAgICB2YWx1ZS5odG1sLFxyXG4gICAgICAgICAgICB2YWx1ZS5oYXNFZGl0b3IsXHJcbiAgICAgICAgICAgIHZhbHVlLnJ1bGUpO1xyXG5cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfTtcclxuXHJcbiAgICBMYXlvdXRFZGl0b3IucmVnaXN0ZXJGYWN0b3J5KFwiSHRtbFwiLCBmdW5jdGlvbih2YWx1ZSkgeyByZXR1cm4gTGF5b3V0RWRpdG9yLkh0bWwuZnJvbSh2YWx1ZSk7IH0pO1xyXG5cclxufSkoalF1ZXJ5LCBMYXlvdXRFZGl0b3IgfHwgKExheW91dEVkaXRvciA9IHt9KSk7Il0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9